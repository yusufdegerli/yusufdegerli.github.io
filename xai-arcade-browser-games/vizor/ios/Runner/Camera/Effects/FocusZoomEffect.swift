import Foundation

/// Zoom and pull focus together — a punch-in that stays sharp on the subject.
final class FocusZoomEffect: BaseCameraEffect, CameraEffectStrategy {
  static let effectType = "focusZoom"

  private var startZoom: CGFloat = 1
  private var targetZoom: CGFloat = 2
  private var startFocus: Float = 0.5
  private var targetFocus: Float = 0.35

  func prepare(in session: CameraSessionController, params: CameraEffectParams) throws {
    self.session = session
    targetZoom = CGFloat(params.double("zoom", default: 2.0))
    targetFocus = Float(params.double("lensPosition", default: 0.35))
    startZoom = session.videoDevice?.videoZoomFactor ?? 1
    startFocus = session.videoDevice?.lensPosition ?? 0.5
    markStarted(duration: params.duration(default: 1.1))
  }

  func apply(params: CameraEffectParams) throws {
    targetZoom = CGFloat(params.double("zoom", default: targetZoom))
    targetFocus = Float(params.double("lensPosition", default: Double(targetFocus)))
    markStarted(duration: params.duration(default: 1.1))
  }

  func tick(deltaTime: CFTimeInterval, motion: CameraMotionSample?) {
    let t = easeInOut(progress)
    try? session?.setZoomFactor(startZoom + (targetZoom - startZoom) * CGFloat(t), animated: false)
    try? session?.setLensPosition(startFocus + (targetFocus - startFocus) * Float(t), animated: false)
  }
}
