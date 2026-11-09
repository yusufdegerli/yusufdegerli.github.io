import AVFoundation
import Foundation

/// Hitchcock / Vertigo: zoom against a complementary framing shift.
final class DollyZoomEffect: BaseCameraEffect, CameraEffectStrategy {
  static let effectType = "dollyZoom"

  private var fromZoom: CGFloat = 1
  private var toZoom: CGFloat = 2
  private var fromFocus: Float = 0.5
  private var toFocus: Float = 0.2

  func prepare(in session: CameraSessionController, params: CameraEffectParams) throws {
    self.session = session
    markStarted(duration: params.duration())
    let intensity = params.double("intensity", default: 0.75)
    let inbound = params.string("direction", default: "in") != "out"
    fromZoom = session.videoDevice?.videoZoomFactor ?? 1
    toZoom = inbound ? fromZoom * (1 + CGFloat(intensity)) : max(1, fromZoom / (1 + CGFloat(intensity)))
    fromFocus = session.videoDevice?.lensPosition ?? 0.5
    toFocus = inbound ? max(0, fromFocus - Float(intensity) * 0.35) : min(1, fromFocus + Float(intensity) * 0.35)
  }

  func apply(params: CameraEffectParams) throws {
    markStarted(duration: params.duration())
  }

  func tick(deltaTime: CFTimeInterval, motion: CameraMotionSample?) {
    let t = easeInOut(progress)
    let zoom = fromZoom + (toZoom - fromZoom) * CGFloat(t)
    let focus = fromFocus + (toFocus - fromFocus) * Float(t)
    try? session?.setZoomFactor(zoom, animated: false)
    try? session?.setLensPosition(focus, animated: false)
  }
}
