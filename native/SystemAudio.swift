import Foundation
import CoreAudio
import Darwin

// Audio only: no screen/window enumeration, video stream, file recording or network.
let outputLock = NSLock()
func emit(_ event: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: event) else { return }
    outputLock.lock(); defer { outputLock.unlock() }
    FileHandle.standardOutput.write(data + Data([10]))
}
func check(_ status: OSStatus, _ operation: String) throws {
    if status != noErr { throw NSError(domain: "ClairAudio", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "\(operation) (\(status))"]) }
}

@available(macOS 14.2, *)
final class SystemAudio {
    var tap: AudioObjectID = 0
    var device: AudioObjectID = 0
    var proc: AudioDeviceIOProcID?
    var format = AudioStreamBasicDescription()
    let queue = DispatchQueue(label: "fr.clair.audio", qos: .userInitiated)
    var pending: [Float] = []
    var outputAddress = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultOutputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var listener: AudioObjectPropertyListenerBlock?

    func start() throws {
        let description = CATapDescription(monoGlobalTapButExcludeProcesses: [])
        description.name = "Clair — son du Mac"
        description.isPrivate = true
        description.muteBehavior = .unmuted
        try check(AudioHardwareCreateProcessTap(description, &tap), "Autorisez l’audio système pour Clair dans Réglages Système → Confidentialité et sécurité")
        var address = AudioObjectPropertyAddress(mSelector: kAudioTapPropertyFormat, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var size = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        try check(AudioObjectGetPropertyData(tap, &address, 0, nil, &size, &format), "Format audio indisponible")
        guard format.mFormatID == kAudioFormatLinearPCM, format.mFormatFlags & kAudioFormatFlagIsFloat != 0, format.mBitsPerChannel == 32, format.mSampleRate > 0 else {
            throw NSError(domain: "ClairAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "Format audio système non pris en charge."])
        }
        let info: [String: Any] = [
            kAudioAggregateDeviceNameKey: "Clair Audio",
            kAudioAggregateDeviceUIDKey: UUID().uuidString,
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceTapAutoStartKey: true,
            kAudioAggregateDeviceTapListKey: [[kAudioSubTapUIDKey: description.uuid.uuidString, kAudioSubTapDriftCompensationKey: true]]
        ]
        try check(AudioHardwareCreateAggregateDevice(info as CFDictionary, &device), "Initialisation de l’audio système impossible")
        try check(AudioDeviceCreateIOProcIDWithBlock(&proc, device, queue) { [weak self] _, input, _, _, _ in
            self?.receive(input)
        }, "Connexion à l’audio système impossible")
        try check(AudioDeviceStart(device, proc), "Autorisez l’enregistrement de l’audio système pour Clair")
        emit(["type": "ready", "sampleRate": format.mSampleRate])
    }
    func receive(_ input: UnsafePointer<AudioBufferList>) {
        let buffers = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: input))
        guard let first = buffers.first, first.mNumberChannels > 0 else { return }
        let frames = Int(first.mDataByteSize) / (4 * Int(first.mNumberChannels))
        guard frames > 0 else { return }
        var mono = [Float](repeating: 0, count: frames)
        var channels = 0
        for buffer in buffers {
            guard let data = buffer.mData?.assumingMemoryBound(to: Float.self) else { continue }
            let n = Int(buffer.mNumberChannels)
            guard n > 0, Int(buffer.mDataByteSize) >= frames * n * 4 else { continue }
            channels += n
            for frame in 0..<frames { for channel in 0..<n { mono[frame] += data[frame * n + channel] } }
        }
        guard channels > 0 else { return }
        for i in mono.indices { mono[i] /= Float(channels); if !mono[i].isFinite { mono[i] = 0 } }
        pending.append(contentsOf: mono)
        // 40 ms packets keep pipe/IPC overhead low without delaying a whole turn.
        let count = max(1, Int(format.mSampleRate * 0.04))
        while pending.count >= count {
            let samples = Array(pending.prefix(count)); pending.removeFirst(count)
            let data = samples.withUnsafeBytes { Data($0) }
            emit(["type": "audio", "sampleRate": format.mSampleRate, "data": data.base64EncodedString()])
        }
    }
    func followOutput() {
        let callback: AudioObjectPropertyListenerBlock = { _, _ in
            // Restart the private tap against the new default output (headset/speakers).
            DispatchQueue.main.async {
                self.stop()
                do { try self.start(); emit(["type": "device-changed"]) }
                catch { self.stop(); emit(["type": "error", "message": error.localizedDescription]); exit(1) }
            }
        }
        listener = callback
        AudioObjectAddPropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &outputAddress, .main, callback)
    }
    func stop() {
        if device != 0 {
            AudioDeviceStop(device, proc)
            if let proc { AudioDeviceDestroyIOProcID(device, proc) }
            AudioHardwareDestroyAggregateDevice(device); device = 0; proc = nil
        }
        if tap != 0 { AudioHardwareDestroyProcessTap(tap); tap = 0 }
        queue.sync { pending.removeAll(keepingCapacity: true) }
    }
}

if CommandLine.arguments.contains("--self-test") {
    emit(["type": "self-test", "audioOnly": true, "protocol": 1]); exit(0)
}
if #available(macOS 14.2, *) {
    signal(SIGPIPE, SIG_IGN)
    let recorder = SystemAudio()
    // Closing stdin (or the Electron parent exiting) also tears down all devices.
    FileHandle.standardInput.readabilityHandler = { handle in
        let data = handle.availableData
        if data.isEmpty || String(data: data, encoding: .utf8)?.contains("stop") == true {
            DispatchQueue.main.async { recorder.stop(); exit(0) }
        }
    }
    signal(SIGTERM, SIG_IGN); signal(SIGINT, SIG_IGN)
    let term = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
    let interrupt = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
    for source in [term, interrupt] { source.setEventHandler { recorder.stop(); exit(0) }; source.resume() }
    do { try recorder.start(); recorder.followOutput(); RunLoop.main.run() }
    catch { recorder.stop(); emit(["type": "error", "message": error.localizedDescription]); exit(1) }
} else { emit(["type": "error", "message": "macOS 14.2 minimum pour l’audio système."]); exit(1) }
