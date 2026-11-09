import Foundation

/// Roll the preview to a held dutch angle. Motion can keep it planted.
final class DutchAngleEffect: BaseCameraEffect, CameraEffectStrategy {
  static let effectType = "dutchAngle"

  private var targetDegrees: CGFloat = 18
  private var animated = true

  func prepare(in session: CameraSessionController, params: CameraEffectParams) throws {
    self.session = session
    targetDegrees = CGFloat(params.double("angle", default: 18))
    animated = params.bool("animated", default: true)
    markStarted(duration: params.duration(default: 0.6))
    session.setPreviewRoll(
      degrees: targetDegrees,
      animated: animated,
      duration: params.duration(default: 0.6)
    )
  }

  func apply(params: CameraEffectParams) throws {
    targetDegrees = CGFloat(params.double("angle", default: targetDegrees))
    session?.setPreviewRoll(
      degrees: targetDegrees,
      animated: params.bool("animated", default: true),
      duration: params.duration(default: 0.6)
    )
  }

  func teardown() {
    session?.resetPreviewTransform()
  }
}
