import Foundation
import UIKit

/// Counter-roll the preview from device motion so handheld reads as a steadicam.
final class SteadicamEffect: BaseCameraEffect, CameraEffectStrategy {
  static let effectType = "steadicam"

  private var strength: Double = 0.65
  private var smoothing: Double = 0.8
  private var filteredRoll: Double = 0

  func prepare(in session: CameraSessionController, params: CameraEffectParams) throws {
    self.session = session
    strength = params.double("strength", default: 0.65)
    smoothing = min(0.95, max(0, params.double("smoothing", default: 0.8)))
  }

  func apply(params: CameraEffectParams) throws {
    strength = params.double("strength", default: strength)
    smoothing = min(0.95, max(0, params.double("smoothing", default: smoothing)))
  }

  func tick(deltaTime: CFTimeInterval, motion: CameraMotionSample?) {
    guard let motion else { return }
    filteredRoll = filteredRoll * smoothing + motion.roll * (1 - smoothing)
    let degrees = CGFloat(-filteredRoll * strength * 180 / .pi)
    session?.setPreviewRoll(degrees: degrees, animated: false)
  }

  func teardown() {
    session?.resetPreviewTransform()
  }
}
