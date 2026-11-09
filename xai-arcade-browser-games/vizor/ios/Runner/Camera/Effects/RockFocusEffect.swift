import AVFoundation
import Foundation

/// Manual rack / rock focus. Flutter sends `targetLensPosition` (0…1).
///
/// Rapid slider updates are coalesced: only one device lock is in flight,
/// and only the latest requested position is written.
final class RockFocusEffect: BaseCameraEffect, CameraEffectStrategy {
  static let effectType = "rockFocus"

  private static let gate = NSLock()
  private static var pending: Float?
  private static var inflight = false
  private static var lastWritten: Float?

  func prepare(in session: CameraSessionController, params: CameraEffectParams) throws {
    self.session = session
    try apply(params: params)
  }

  func apply(params: CameraEffectParams) throws {
    let target = Float(min(1, max(0, params.double("targetLensPosition", default: 0.5))))
    Self.enqueue(target)
  }

  private static func enqueue(_ target: Float) {
    gate.lock()
    pending = target
    let start = !inflight
    if start { inflight = true }
    gate.unlock()
    guard start else { return }
    pump()
  }

  private static func pump() {
    try? CameraSessionController.shared.withDeviceLock { device in
      gate.lock()
      let next = pending
      pending = nil
      gate.unlock()

      if let next, device.isLockingFocusWithCustomLensPositionSupported {
        let unchanged = lastWritten.map { abs($0 - next) < 0.01 } ?? false
        if !unchanged {
          device.setFocusModeLocked(lensPosition: next, completionHandler: nil)
          lastWritten = next
        }
      }

      gate.lock()
      let again = pending != nil
      if !again { inflight = false }
      gate.unlock()
      if again {
        pump()
      }
    }
  }
}
