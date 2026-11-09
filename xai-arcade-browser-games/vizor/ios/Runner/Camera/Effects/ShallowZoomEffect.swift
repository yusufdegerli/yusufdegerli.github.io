import Foundation

/// Gentle zoom that biases toward a shallower perceived plane.
final class ShallowZoomEffect: BaseCameraEffect, CameraEffectStrategy {
  static let effectType = "shallowZoom"

  private var targetZoom: CGFloat = 1.6
  private var startZoom: CGFloat = 1

  func prepare(in session: CameraSessionController, params: CameraEffectParams) throws {
    self.session = session
    targetZoom = CGFloat(params.double("zoom", default: 1.6))
    startZoom = session.videoDevice?.videoZoomFactor ?? 1
    markStarted(duration: params.duration(default: 0.9))
  }

  func apply(params: CameraEffectParams) throws {
    targetZoom = CGFloat(params.double("zoom", default: targetZoom))
    markStarted(duration: params.duration(default: 0.9))
  }

  func tick(deltaTime: CFTimeInterval, motion: CameraMotionSample?) {
    let t = easeInOut(progress)
    let zoom = startZoom + (targetZoom - startZoom) * CGFloat(t)
    try? session?.setZoomFactor(zoom, animated: false)
  }
}
