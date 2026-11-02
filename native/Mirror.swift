import AppKit
import ScreenCaptureKit
import CoreMedia
import CoreImage
import CoreGraphics
import Darwin

func emit(_ value: [String: Any]) { if let data = try? JSONSerialization.data(withJSONObject: value) { FileHandle.standardOutput.write(data + Data([10])) } }
func failure(_ text: String) -> NSError { NSError(domain: "ClairMirror", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }
func excluded(_ pid: pid_t, _ bundle: String, parent: pid_t) -> Bool { pid == parent || pid == getpid() || bundle == "fr.clair.assistant" || bundle.hasPrefix("fr.clair.assistant.") }
func dimensions(_ width: Int, _ height: Int, quality: String) -> (Int, Int) { if quality == "native" { return (max(1, width), max(1, height)) }; let ratio = min(1, 1920.0 / Double(max(1, width)), 1080.0 / Double(max(1, height))); return (max(2, Int(Double(width) * ratio) / 2 * 2), max(2, Int(Double(height) * ratio) / 2 * 2)) }
if CommandLine.arguments.contains("--self-test") {
 precondition(excluded(123, "", parent: 123)); precondition(excluded(456, "fr.clair.assistant.mirror", parent: 123)); precondition(!excluded(456, "org.mozilla.firefox", parent: 123))
 let (w, h) = dimensions(5120, 2880, quality: "economy"); precondition(w == 1920 && h == 1080)
 let native = dimensions(5120, 2880, quality: "native"); precondition(native.0 == 5120 && native.1 == 2880)
 let portrait = dimensions(2880, 5120, quality: "native"); precondition(portrait.0 == 2880 && portrait.1 == 5120)
 emit(["type": "self-test", "ok": true]); exit(0)
}
func argument(_ key: String) -> String? { guard let i = CommandLine.arguments.firstIndex(of: key), i + 1 < CommandLine.arguments.count else { return nil }; return CommandLine.arguments[i + 1] }
guard let source = argument("--source").flatMap(UInt32.init), let target = argument("--target").flatMap(UInt32.init), let parent = argument("--parent").flatMap(Int32.init), source != target, parent > 1 else { emit(["type": "error", "message": "Choisissez deux écrans distincts."]); exit(1) }

let quality = argument("--quality") ?? "native"
guard ["native", "economy"].contains(quality) else { emit(["type": "error", "message": "Qualité de recopie invalide."]); exit(1) }

final class MirrorWindow: NSWindow {
 override var canBecomeKey: Bool { true }
 override func keyDown(with event: NSEvent) { if event.keyCode == 53 { NSApp.terminate(nil) } }
}
final class Mirror: NSObject, NSApplicationDelegate, NSWindowDelegate, SCStreamOutput, SCStreamDelegate {
 let source: CGDirectDisplayID, target: CGDirectDisplayID, parent: pid_t
 let quality: String
 init(source: CGDirectDisplayID, target: CGDirectDisplayID, parent: pid_t, quality: String) { self.quality = quality; self.source = source; self.target = target; self.parent = parent; super.init() }
 var window: NSWindow?
 var image: NSImageView?
 var stream: SCStream?
 var stopping = false
 let context = CIContext(options: [.cacheIntermediates: false])
 let frames = DispatchQueue(label: "fr.clair.mirror.frames", qos: .userInteractive)
 let lock = NSLock()
 var pending = false
 func applicationDidFinishLaunching(_ notification: Notification) {
  NotificationCenter.default.addObserver(self, selector: #selector(screenChanged), name: NSApplication.didChangeScreenParametersNotification, object: nil)
  DispatchQueue.global().async { while readLine() != nil {} ; DispatchQueue.main.async { NSApp.terminate(nil) } }
  Task { @MainActor in do { try await start() } catch { finish(error.localizedDescription) } }
 }
 @MainActor func start() async throws {
  guard CGPreflightScreenCaptureAccess() || CGRequestScreenCaptureAccess() else { throw failure("Autorisez Clair ou Clair Recopie dans Enregistrement de l’écran, puis réessayez. Un redémarrage de Clair peut être nécessaire.") }
  guard CGDisplayMirrorsDisplay(source) == kCGNullDirectDisplay, CGDisplayMirrorsDisplay(target) == kCGNullDirectDisplay else { throw failure("Choisissez Affichage étendu dans les réglages Moniteurs de macOS.") }
  let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
  guard let display = content.displays.first(where: { $0.displayID == source }), content.displays.contains(where: { $0.displayID == target }), let screen = NSScreen.screens.first(where: { ($0.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value == target }) else { throw failure("L’un des écrans est indisponible.") }
  let hidden = content.applications.filter { excluded($0.processID, $0.bundleIdentifier, parent: parent) }
  guard hidden.contains(where: { $0.processID == parent }) else { throw failure("Impossible de confirmer l’exclusion de Clair. Recopie annulée.") }
  let filter = SCContentFilter(display: display, excludingApplications: hidden, exceptingWindows: [])
  let scale = Double(filter.pointPixelScale), rect = filter.contentRect
  guard scale.isFinite, scale > 0, rect.width > 0, rect.height > 0 else { throw failure("Résolution native indisponible pour cet écran.") }
  let (width, height) = dimensions(Int((rect.width * scale).rounded()), Int((rect.height * scale).rounded()), quality: quality)
  let fps: Int32 = quality == "native" ? 60 : 30
  let config = SCStreamConfiguration()
  config.captureResolution = quality == "native" ? .best : .automatic
  config.width = width; config.height = height; config.minimumFrameInterval = CMTime(value: 1, timescale: fps); config.queueDepth = 3; config.pixelFormat = kCVPixelFormatType_32BGRA; config.showsCursor = true; config.capturesAudio = false
  let capture = SCStream(filter: filter, configuration: config, delegate: self)
  try capture.addStreamOutput(self, type: .screen, sampleHandlerQueue: frames)
  stream = capture
  // No pixels leave this native process. No file, socket, audio or AI transport.
  let view = NSImageView(frame: NSRect(origin: .zero, size: screen.frame.size)); view.imageScaling = .scaleProportionallyUpOrDown; view.autoresizingMask = [.width, .height]
  let win = MirrorWindow(contentRect: screen.frame, styleMask: [.borderless], backing: .buffered, defer: false)
  win.title = "Clair — Recopie sans Clair"; win.backgroundColor = .black; win.contentView = view; win.delegate = self; win.level = .floating; win.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]; win.isReleasedWhenClosed = false

  window = win; image = view
  try await capture.startCapture()
  guard !stopping else { return }
  win.orderFrontRegardless(); emit(["type": "ready", "source": source, "target": target, "quality": quality, "width": width, "height": height, "fps": fps])
 }
 func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
  guard outputType == .screen, CMSampleBufferDataIsReady(sampleBuffer), let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
  if let data = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]], let status = data.first?[.status] as? Int, status != SCFrameStatus.complete.rawValue { return }
  lock.lock(); if pending { lock.unlock(); return }; pending = true; lock.unlock()
  let frame = CIImage(cvPixelBuffer: buffer), cgImage = context.createCGImage(frame, from: frame.extent)
  DispatchQueue.main.async { [weak self] in
   guard let self else { return }; defer { self.lock.lock(); self.pending = false; self.lock.unlock() }
   if !self.stopping, let cgImage { self.image?.image = NSImage(cgImage: cgImage, size: .zero) }
  }
 }
 func stream(_ stream: SCStream, didStopWithError error: Error) { DispatchQueue.main.async { self.finish("Recopie interrompue : " + error.localizedDescription) } }
 func finish(_ message: String) { guard !stopping else { return }; stopping = true; window?.orderOut(nil); emit(["type": "error", "message": message]); NSApp.terminate(nil) }
 @objc func screenChanged() { finish("La disposition des écrans a changé. Relancez la recopie.") }
 func windowWillClose(_ notification: Notification) { NSApp.terminate(nil) }
 func applicationWillTerminate(_ notification: Notification) { stopping = true; window?.orderOut(nil); image?.image = nil; if let stream { Task { try? await stream.stopCapture() } }; emit(["type": "stopped"]) }
}
let application = NSApplication.shared
application.setActivationPolicy(.accessory)
let delegate = Mirror(source: source, target: target, parent: parent, quality: quality); application.delegate = delegate
application.run()
