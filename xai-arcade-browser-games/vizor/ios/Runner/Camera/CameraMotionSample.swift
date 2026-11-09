import CoreMotion
import Foundation

/// Latest IMU reading handed to strategies that stabilize or roll the frame.
struct CameraMotionSample {
  let timestamp: TimeInterval
  let roll: Double
  let pitch: Double
  let yaw: Double
  let rotationRateX: Double
  let rotationRateY: Double
  let rotationRateZ: Double

  static func from(_ motion: CMDeviceMotion) -> CameraMotionSample {
    CameraMotionSample(
      timestamp: motion.timestamp,
      roll: motion.attitude.roll,
      pitch: motion.attitude.pitch,
      yaw: motion.attitude.yaw,
      rotationRateX: motion.rotationRate.x,
      rotationRateY: motion.rotationRate.y,
      rotationRateZ: motion.rotationRate.z
    )
  }
}
