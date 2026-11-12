import Foundation
import AppKit
import CoreGraphics
import ApplicationServices

func output(_ value: [String: Any]) { if let data = try? JSONSerialization.data(withJSONObject: value), var line = String(data: data, encoding: .utf8) { line += "\n"; FileHandle.standardOutput.write(Data(line.utf8)) } }
func modifiers(_ flags: CGEventFlags) -> Int { (flags.contains(.maskShift) ? 1 : 0) | (flags.contains(.maskControl) ? 2 : 0) | (flags.contains(.maskAlternate) ? 4 : 0) | (flags.contains(.maskCommand) ? 8 : 0) }
func validBinding(_ raw: Any?) -> [String: Int]? {
 guard let value = raw as? [String: Any], let mods = value["modifiers"] as? Int, (0...15).contains(mods) else { return nil }
 if let key = value["keyCode"] as? Int {
  guard value["button"] == nil, (0...127).contains(key), mods & 14 != 0 else { return nil }
  return ["keyCode": key, "modifiers": mods]
 }
 guard let button = value["button"] as? Int, (0...31).contains(button), button != 0 || mods != 0 else { return nil }
 return ["button": button, "modifiers": mods]
}
func matches(_ binding: [String: Int], key: Int?, button: Int?, mods: Int) -> Bool {
 binding["modifiers"] == mods && (key != nil ? binding["keyCode"] == key : binding["button"] == button)
}

func validBindings(_ raw: Any?) -> [[String: Int]] {
 let items = raw as? [Any] ?? (raw.map { [$0] } ?? [])
 return items.compactMap { validBinding($0) }.prefix(12).map { $0 }
}
let firefoxIDs: Set<String> = ["org.mozilla.firefox", "org.mozilla.firefoxdeveloperedition", "org.mozilla.nightly"]
if CommandLine.arguments.contains("--self-test") {
 precondition(modifiers([.maskShift, .maskAlternate]) == 5)
 precondition(validBinding(["button": 0, "modifiers": 0]) == nil)
 precondition(validBinding(["button": 31, "modifiers": 4]) != nil)
 precondition(validBindings([["button": 3, "modifiers": 0], ["button": 4, "modifiers": 8]]).count == 2)
 precondition(validBindings(["button": 3, "modifiers": 0]).count == 1)
 precondition(validBindings(nil).isEmpty)
 precondition(validBinding(["keyCode": 12, "modifiers": 0]) == nil)
 precondition(validBinding(["keyCode": 12, "modifiers": 1]) == nil)
 precondition(validBinding(["keyCode": 12, "modifiers": 8, "keyLabel": "Q"]) != nil)
 precondition(matches(["keyCode": 12, "modifiers": 8], key: 12, button: nil, mods: 8))
 precondition(!matches(["button": 12, "modifiers": 8], key: 12, button: nil, mods: 8))
 output(["type": "self-test", "ok": true]); exit(0)
}
let request = CommandLine.arguments.contains("--request")
let trusted = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: request] as CFDictionary)
if !trusted { output(["type": "permission", "message": "Autorisez Clair dans Accessibilité, puis cliquez sur Activer."]); exit(2) }
var enabled = false, learning = false, learningKeys = false
var bindings: [String: [[String: Int]]] = [:]
var consumed = Set<Int>(), consumedKeys = Set<Int>()
let syntheticTag: Int64 = 0x434c414952
var tap: CFMachPort?
var lastAction: TimeInterval = 0
func configure(_ raw: [String: Any]) {
 enabled = raw["enabled"] as? Bool ?? false; learning = raw["learning"] as? Bool ?? false; learningKeys = raw["learningKeys"] as? Bool ?? false
 bindings.removeAll()
 if let values = raw["bindings"] as? [String: Any] { for action in ["background", "firefox"] { bindings[action] = validBindings(values[action]) } }
}
func firefoxShortcut() -> Bool {
 guard let target = NSWorkspace.shared.frontmostApplication, firefoxIDs.contains(target.bundleIdentifier ?? "") else { return false }
 guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 8, keyDown: true), let up = CGEvent(keyboardEventSource: nil, virtualKey: 8, keyDown: false) else { return false }
 down.flags = [.maskAlternate, .maskShift]; up.flags = [.maskAlternate, .maskShift]
 down.setIntegerValueField(.eventSourceUserData, value: syntheticTag); up.setIntegerValueField(.eventSourceUserData, value: syntheticTag)
 down.postToPid(target.processIdentifier); up.postToPid(target.processIdentifier); return true
}
let callback: CGEventTapCallBack = { _, type, event, _ in
 if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput { if let current = tap { CGEvent.tapEnable(tap: current, enable: true) }; return Unmanaged.passUnretained(event) }
 if event.getIntegerValueField(.eventSourceUserData) == syntheticTag { return Unmanaged.passUnretained(event) }
 let keyboard = type == .keyDown || type == .keyUp
 let key: Int? = keyboard ? Int(event.getIntegerValueField(.keyboardEventKeycode)) : nil
 let button: Int? = keyboard ? nil : Int(event.getIntegerValueField(.mouseEventButtonNumber))
 let down = keyboard ? type == .keyDown : type == .leftMouseDown || type == .rightMouseDown || type == .otherMouseDown
 if !down {
  if let key, consumedKeys.remove(key) != nil { return nil }
  if let button, consumed.remove(button) != nil { return nil }
  return Unmanaged.passUnretained(event)
 }
 let mods = modifiers(event.flags)
 if keyboard && event.getIntegerValueField(.keyboardEventAutorepeat) != 0 { return key.map { consumedKeys.contains($0) } == true ? nil : Unmanaged.passUnretained(event) }
 if learning {
  if let key {
   guard learningKeys else { return Unmanaged.passUnretained(event) }
   if key == 53 { consumedKeys.insert(key); learning = false; output(["type": "learn-canceled"]); return nil }
   guard mods & 14 != 0 else { return Unmanaged.passUnretained(event) }
   let names = [36: "↩", 48: "⇥", 49: "Espace", 51: "⌫", 53: "Échap", 123: "←", 124: "→", 125: "↓", 126: "↑"]
   let label = names[key] ?? NSEvent(cgEvent: event)?.charactersIgnoringModifiers?.uppercased() ?? "Touche \(key)"
   consumedKeys.insert(key); learning = false
   output(["type": "key", "keyCode": key, "modifiers": mods, "keyLabel": String(label.prefix(24)), "learning": true]); return nil
  }
  if let button { consumed.insert(button); learning = false; output(["type": "button", "button": button, "modifiers": mods, "learning": true]); return nil }
 }
 guard enabled else { return Unmanaged.passUnretained(event) }
 // Ordinary typing is never published or retained. Only selected shortcuts match.
 if let button { output(["type": "button", "button": button, "modifiers": mods, "learning": false]) }
 for action in ["background", "firefox"] {
  guard let choices = bindings[action], choices.contains(where: { matches($0, key: key, button: button, mods: mods) }) else { continue }
  if action == "firefox" && !firefoxIDs.contains(NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "") { return Unmanaged.passUnretained(event) }
  if let key { consumedKeys.insert(key) }; if let button { consumed.insert(button) }
  let now = ProcessInfo.processInfo.systemUptime
  if now - lastAction < 0.35 { return nil }; lastAction = now
  if action == "firefox" { let sent = firefoxShortcut(); output(["type": "action", "action": action, "sent": sent]) }
  else { output(["type": "action", "action": action]) }
  return nil
 }
 return Unmanaged.passUnretained(event)
}
let types: [CGEventType] = [.keyDown, .keyUp, .leftMouseDown, .leftMouseUp, .rightMouseDown, .rightMouseUp, .otherMouseDown, .otherMouseUp]
let mask = types.reduce(CGEventMask(0)) { $0 | (CGEventMask(1) << $1.rawValue) }
guard let created = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .defaultTap, eventsOfInterest: mask, callback: callback, userInfo: nil) else { output(["type": "permission", "message": "Activez l’Accessibilité pour Clair (ou Clair Souris), puis relancez la détection."]); exit(2) }
tap = created
CFRunLoopAddSource(CFRunLoopGetMain(), CFMachPortCreateRunLoopSource(kCFAllocatorDefault, created, 0), .commonModes)
CGEvent.tapEnable(tap: created, enable: true)
DispatchQueue.global(qos: .utility).async {
 while let line = readLine() { if line.utf8.count > 4096 { continue }; if let data = line.data(using: .utf8), let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] { DispatchQueue.main.async { configure(value) } } }
 DispatchQueue.main.async { CFRunLoopStop(CFRunLoopGetMain()) }
}
output(["type": "ready"])
CFRunLoopRun()
