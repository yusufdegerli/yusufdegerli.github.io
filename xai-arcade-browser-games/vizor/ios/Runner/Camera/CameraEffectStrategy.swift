import Foundation
import QuartzCore

/// One cinematic move. Add a new effect by conforming to this protocol
/// and registering the type in `CameraEffectRegistry.bootstrap()`.
///
/// Do not switch on `effectType` in AppDelegate — the registry instantiates
/// the matching strategy.
protocol CameraEffectStrategy: AnyObject {
  static var effectType: String { get }

  init()

  /// Called once after construction, before the first `apply`.
  func prepare(in session: CameraSessionController, params: CameraEffectParams) throws

  /// Apply or re-apply parameters (button tap, slider, second call).
  func apply(params: CameraEffectParams) throws

  /// Frame callback from the session display link. Keep this cheap.
  func tick(deltaTime: CFTimeInterval, motion: CameraMotionSample?)

  /// Release device locks, transforms, and timers.
  func teardown()
}

extension CameraEffectStrategy {
  var effectType: String { Self.effectType }

  func apply(params: CameraEffectParams) throws {}

  func tick(deltaTime: CFTimeInterval, motion: CameraMotionSample?) {}

  func teardown() {}
}

/// Shared conveniences so new effects stay small.
class BaseCameraEffect: NSObject {
  weak var session: CameraSessionController?
  private(set) var startedAt: CFTimeInterval = 0
  private(set) var duration: TimeInterval = 1

  func markStarted(duration: TimeInterval) {
    startedAt = CACurrentMediaTime()
    self.duration = max(0.01, duration)
  }

  var progress: Double {
    min(1, max(0, (CACurrentMediaTime() - startedAt) / duration))
  }

  func easeInOut(_ t: Double) -> Double {
    t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2
  }
}
