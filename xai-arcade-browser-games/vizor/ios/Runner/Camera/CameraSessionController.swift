import AVFoundation
import CoreMotion
import Photos
import QuartzCore
import UIKit

/// Owns the single `AVCaptureSession` and `CMMotionManager`.
/// Strategies never create their own session — they ask this controller.
///
/// Threading:
/// - Capture setup, `startRunning`, and every `lockForConfiguration` run on `sessionQueue`.
/// - Preview-layer and display-link work always hop back to the main thread.
/// - Never `sessionQueue.sync` from main (the queue hops to main for preview).
/// - Never lock the device on main — that freezes the viewfinder.
final class CameraSessionController: NSObject {
  static let shared = CameraSessionController()

  let session = AVCaptureSession()
  let previewLayer = AVCaptureVideoPreviewLayer()
  let motionManager = CMMotionManager()

  private let sessionQueue = DispatchQueue(label: "com.yusufdegerli.vizor.camera.session")
  private static let sessionQueueKey = DispatchSpecificKey<UInt8>()
  private static let sessionQueueToken: UInt8 = 1

  private let photoOutput = AVCapturePhotoOutput()
  private var photoCompletions: [Int64: (String?, Error?) -> Void] = [:]

  private var displayLink: CADisplayLink?
  private var lastTick: CFTimeInterval = 0
  private var currentEffect: CameraEffectStrategy?
  private var configured = false

  /// Bumped on main for every apply/clear. Stale session-queue work bails.
  private var effectGeneration: UInt64 = 0

  /// Session-queue only. Lets `withDeviceLock` nest (Rock Focus pump, zoom+focus flush).
  private var deviceLockDepth = 0

  /// Latest zoom/focus requested by any strategy. Flushed under one lock.
  private var pendingZoom: (factor: CGFloat, animated: Bool, rate: Float)?
  private var pendingFocus: (position: Float, animated: Bool)?
  private var deviceWriteScheduled = false
  private var acceptDeviceWrites = true

  private(set) var videoDevice: AVCaptureDevice?
  private(set) var latestMotion: CameraMotionSample?

  private override init() {
    super.init()
    sessionQueue.setSpecific(
      key: CameraSessionController.sessionQueueKey,
      value: CameraSessionController.sessionQueueToken
    )
    // Layer mutations must happen on the main thread — never during +init
    // if the singleton is first touched off-main.
    DispatchQueue.main.async { [weak self] in
      self?.bindPreviewLayerOnMain()
    }
  }

  var activeEffectType: String? {
    currentEffect.map { type(of: $0).effectType }
  }

  // MARK: - Lifecycle

  func start() {
    sessionQueue.async { [weak self] in
      self?.startOnSessionQueue()
    }
  }

  func stop() {
    performOnMain { [weak self] in
      guard let self else { return }
      self.effectGeneration += 1
      let outgoing = self.currentEffect
      self.currentEffect = nil
      outgoing?.teardown()
    }
    sessionQueue.async { [weak self] in
      guard let self else { return }
      self.discardPendingDeviceWrites()
      if self.session.isRunning {
        self.session.stopRunning()
      }
      DispatchQueue.main.async { [weak self] in
        self?.stopMotionAndClockOnMain()
      }
    }
  }

  /// Swap the active strategy without blocking the platform thread.
  /// Unknown types fail immediately — never silently no-op.
  func apply(
    effectType: String,
    params: CameraEffectParams,
    completion: @escaping (Error?) -> Void
  ) {
    guard let make = CameraEffectRegistry.make(effectType) else {
      completion(CameraEffectError.unknownEffect(effectType))
      return
    }
    performOnMain { [weak self] in
      guard let self else {
        completion(CameraEffectError.sessionUnavailable("Session released"))
        return
      }
      self.effectGeneration += 1
      let generation = self.effectGeneration

      if let current = self.currentEffect, type(of: current).effectType == effectType {
        do {
          try current.apply(params: params)
          completion(nil)
        } catch {
          completion(error)
        }
        return
      }

      // Stop ticks before the session-queue transition so the outgoing
      // strategy cannot enqueue more zoom/focus writes.
      let outgoing = self.currentEffect
      self.currentEffect = nil
      outgoing?.teardown()

      self.sessionQueue.async { [weak self] in
        guard let self else {
          completion(CameraEffectError.sessionUnavailable("Session released"))
          return
        }
        self.transitionToEffect(
          generation: generation,
          make: make,
          params: params,
          completion: completion
        )
      }
    }
  }

  func clearEffect(completion: ((Error?) -> Void)? = nil) {
    performOnMain { [weak self] in
      guard let self else {
        completion?(CameraEffectError.sessionUnavailable("Session released"))
        return
      }
      self.effectGeneration += 1
      let outgoing = self.currentEffect
      self.currentEffect = nil
      outgoing?.teardown()
      self.resetPreviewTransform()

      self.sessionQueue.async { [weak self] in
        guard let self else {
          completion?(CameraEffectError.sessionUnavailable("Session released"))
          return
        }
        self.restoreIdleDeviceOnSessionQueue()
        completion?(nil)
      }
    }
  }

  /// Grabs a JPEG still from the live session and writes it to the Photo Library.
  /// Completes with the Photos local identifier, or an error.
  func takePhoto(completion: @escaping (String?, Error?) -> Void) {
    sessionQueue.async { [weak self] in
      self?.captureStillOnSessionQueue(completion: completion)
    }
  }

  // MARK: - Device lock

  /// Sole entry for `lockForConfiguration` used by every strategy.
  ///
  /// - On `sessionQueue`: runs now, re-entrant if a lock is already held.
  /// - Off queue (display link, MethodChannel): hops async. Never `.sync`.
  /// - Off-queue errors cannot surface to the caller; setters already `try?`.
  func withDeviceLock(_ body: @escaping (AVCaptureDevice) throws -> Void) throws {
    if isOnSessionQueue() {
      try lockAndRun(body)
      return
    }
    sessionQueue.async { [weak self] in
      try? self?.lockAndRun(body)
    }
  }

  func setZoomFactor(_ factor: CGFloat, animated: Bool, rate: Float = 2.0) throws {
    enqueueDeviceWrite { ctrl in
      ctrl.pendingZoom = (factor, animated, rate)
    }
  }

  func setLensPosition(_ position: Float, animated: Bool) throws {
    enqueueDeviceWrite { ctrl in
      ctrl.pendingFocus = (position, animated)
    }
  }

  func setPreviewRoll(degrees: CGFloat, animated: Bool, duration: TimeInterval = 0.35) {
    let work = { [weak self] in
      guard let self else { return }
      let radians = degrees * .pi / 180
      let transform = CATransform3DMakeRotation(radians, 0, 0, 1)
      if animated {
        CATransaction.begin()
        CATransaction.setAnimationDuration(duration)
        self.previewLayer.transform = transform
        CATransaction.commit()
      } else {
        self.previewLayer.transform = transform
      }
    }
    performOnMain(work)
  }

  func resetPreviewTransform() {
    let work = { [weak self] in
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      self?.previewLayer.transform = CATransform3DIdentity
      CATransaction.commit()
    }
    performOnMain(work)
  }

  // MARK: - Effect transitions

  private func transitionToEffect(
    generation: UInt64,
    make: CameraEffectRegistry.Factory,
    params: CameraEffectParams,
    completion: @escaping (Error?) -> Void
  ) {
    discardPendingDeviceWrites()
    cancelZoomRampOnSessionQueue()
    startOnSessionQueue()
    acceptDeviceWrites = true

    let effect = make()
    do {
      try effect.prepare(in: self, params: params)
      try effect.apply(params: params)
    } catch {
      DispatchQueue.main.async { completion(error) }
      return
    }

    DispatchQueue.main.async { [weak self] in
      guard let self else {
        completion(CameraEffectError.sessionUnavailable("Session released"))
        return
      }
      guard generation == self.effectGeneration else {
        effect.teardown()
        completion(nil)
        return
      }
      self.currentEffect = effect
      completion(nil)
    }
  }

  // MARK: - Coalesced zoom / focus

  private func enqueueDeviceWrite(_ mutate: @escaping (CameraSessionController) -> Void) {
    let schedule: (CameraSessionController) -> Void = { ctrl in
      mutate(ctrl)
      guard !ctrl.deviceWriteScheduled else { return }
      ctrl.deviceWriteScheduled = true
      ctrl.sessionQueue.async { [weak ctrl] in
        ctrl?.flushDeviceWritesOnSessionQueue()
      }
    }
    if isOnSessionQueue() {
      schedule(self)
      return
    }
    sessionQueue.async { [weak self] in
      guard let self else { return }
      schedule(self)
    }
  }

  private func flushDeviceWritesOnSessionQueue() {
    deviceWriteScheduled = false
    guard acceptDeviceWrites else {
      pendingZoom = nil
      pendingFocus = nil
      return
    }
    let zoom = pendingZoom
    let focus = pendingFocus
    pendingZoom = nil
    pendingFocus = nil
    guard zoom != nil || focus != nil else { return }

    try? lockAndRun { device in
      if let zoom {
        let minZ = device.minAvailableVideoZoomFactor
        let maxZ = device.maxAvailableVideoZoomFactor
        let clamped = min(max(zoom.factor, minZ), maxZ)
        if device.isRampingVideoZoom {
          device.cancelVideoZoomRamp()
        }
        if zoom.animated {
          device.ramp(toVideoZoomFactor: clamped, withRate: zoom.rate)
        } else {
          device.videoZoomFactor = clamped
        }
      }
      if let focus, device.isLockingFocusWithCustomLensPositionSupported {
        let clamped = min(max(focus.position, 0), 1)
        device.setFocusModeLocked(lensPosition: clamped, completionHandler: nil)
      }
    }
  }

  private func discardPendingDeviceWrites() {
    pendingZoom = nil
    pendingFocus = nil
    acceptDeviceWrites = false
    deviceWriteScheduled = false
  }

  private func cancelZoomRampOnSessionQueue() {
    try? lockAndRun { device in
      if device.isRampingVideoZoom {
        device.cancelVideoZoomRamp()
      }
    }
  }

  private func restoreIdleDeviceOnSessionQueue() {
    discardPendingDeviceWrites()
    try? lockAndRun { device in
      if device.isRampingVideoZoom {
        device.cancelVideoZoomRamp()
      }
      let idle = device.minAvailableVideoZoomFactor
      if abs(device.videoZoomFactor - idle) > 0.01 {
        device.videoZoomFactor = idle
      }
      self.applyIdleFocusAndExposure(on: device)
    }
    acceptDeviceWrites = true
  }

  // MARK: - Session queue

  private func startOnSessionQueue() {
    let status = AVCaptureDevice.authorizationStatus(for: .video)
    switch status {
    case .authorized:
      configureAndRunOnSessionQueue()
    case .notDetermined:
      // Prompt off the main thread; resume setup on the session queue.
      AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
        guard granted else { return }
        self?.sessionQueue.async {
          self?.configureAndRunOnSessionQueue()
        }
      }
    default:
      break
    }
  }

  private func configureAndRunOnSessionQueue() {
    configureIfNeeded()
    if !session.isRunning {
      session.startRunning()
    }
    DispatchQueue.main.async { [weak self] in
      self?.bindPreviewLayerOnMain()
      self?.startMotionAndClockOnMain()
    }
  }

  private func configureIfNeeded() {
    guard !configured else { return }
    session.beginConfiguration()
    session.sessionPreset = .hd1920x1080

    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
          let input = try? AVCaptureDeviceInput(device: device),
          session.canAddInput(input)
    else {
      session.commitConfiguration()
      return
    }
    session.addInput(input)
    videoDevice = device
    enableContinuousAutoFocus(on: device)

    let output = AVCaptureVideoDataOutput()
    output.alwaysDiscardsLateVideoFrames = true
    if session.canAddOutput(output) {
      session.addOutput(output)
    }
    if session.canAddOutput(photoOutput) {
      session.addOutput(photoOutput)
      if #available(iOS 16.0, *) {
        photoOutput.maxPhotoQualityPrioritization = .quality
      }
    }
    applyPortraitOrientation(to: output.connection(with: .video))
    applyPortraitOrientation(to: photoOutput.connection(with: .video))
    session.commitConfiguration()
    configured = true
  }

  /// Safe: only sets modes the hardware reports as supported.
  private func enableContinuousAutoFocus(on _: AVCaptureDevice) {
    let configure: (AVCaptureDevice) throws -> Void = { [weak self] device in
      self?.applyIdleFocusAndExposure(on: device)
    }
    if isOnSessionQueue() {
      try? lockAndRun(configure)
    } else {
      sessionQueue.async { [weak self] in
        try? self?.lockAndRun(configure)
      }
    }
  }

  private func applyIdleFocusAndExposure(on device: AVCaptureDevice) {
    if device.isFocusModeSupported(.continuousAutoFocus) {
      device.focusMode = .continuousAutoFocus
    }
    if device.isSmoothAutoFocusSupported {
      device.isSmoothAutoFocusEnabled = true
    }
    if device.isFocusPointOfInterestSupported {
      device.focusPointOfInterest = CGPoint(x: 0.5, y: 0.5)
    }
    if device.isExposureModeSupported(.continuousAutoExposure) {
      device.exposureMode = .continuousAutoExposure
    }
    if device.isExposurePointOfInterestSupported {
      device.exposurePointOfInterest = CGPoint(x: 0.5, y: 0.5)
    }
    device.isSubjectAreaChangeMonitoringEnabled = true
  }

  private func applyPortraitOrientation(to connection: AVCaptureConnection?) {
    guard let connection, connection.isVideoOrientationSupported else { return }
    connection.videoOrientation = .portrait
  }

  private func bindPreviewLayerOnMain() {
    if previewLayer.session !== session {
      previewLayer.session = session
    }
    previewLayer.videoGravity = .resizeAspectFill
    applyPortraitOrientation(to: previewLayer.connection)
    previewLayer.contentsGravity = .resizeAspectFill
  }

  private func startMotionAndClockOnMain() {
    if motionManager.isDeviceMotionAvailable, !motionManager.isDeviceMotionActive {
      motionManager.deviceMotionUpdateInterval = 1.0 / 60.0
      motionManager.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: .main) { [weak self] motion, _ in
        guard let motion else { return }
        self?.latestMotion = CameraMotionSample.from(motion)
      }
    }
    // Re-creating the display link on every effect swap hitchs the preview.
    guard displayLink == nil else { return }
    let link = CADisplayLink(target: self, selector: #selector(onTick(_:)))
    link.add(to: .main, forMode: .common)
    displayLink = link
    lastTick = CACurrentMediaTime()
  }

  private func stopMotionAndClockOnMain() {
    motionManager.stopDeviceMotionUpdates()
    displayLink?.invalidate()
    displayLink = nil
  }

  @objc private func onTick(_ link: CADisplayLink) {
    let now = CACurrentMediaTime()
    let dt = now - lastTick
    lastTick = now
    currentEffect?.tick(deltaTime: dt, motion: latestMotion)
  }

  private func isOnSessionQueue() -> Bool {
    DispatchQueue.getSpecific(key: CameraSessionController.sessionQueueKey)
      == CameraSessionController.sessionQueueToken
  }

  private func performOnMain(_ work: @escaping () -> Void) {
    if Thread.isMainThread {
      work()
    } else {
      DispatchQueue.main.async(execute: work)
    }
  }

  private func lockAndRun(_ body: @escaping (AVCaptureDevice) throws -> Void) throws {
    guard isOnSessionQueue() else {
      sessionQueue.async { [weak self] in
        try? self?.lockAndRun(body)
      }
      return
    }
    guard let device = videoDevice ?? AVCaptureDevice.default(
      .builtInWideAngleCamera,
      for: .video,
      position: .back
    ) else {
      throw CameraEffectError.sessionUnavailable("No video device")
    }
    if deviceLockDepth > 0 {
      try body(device)
      return
    }
    try device.lockForConfiguration()
    deviceLockDepth += 1
    defer {
      deviceLockDepth -= 1
      device.unlockForConfiguration()
    }
    try body(device)
  }

  private func captureStillOnSessionQueue(completion: @escaping (String?, Error?) -> Void) {
    let status = AVCaptureDevice.authorizationStatus(for: .video)
    switch status {
    case .authorized:
      break
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
        guard granted else {
          completion(nil, CameraEffectError.sessionUnavailable("Camera permission denied"))
          return
        }
        self?.sessionQueue.async {
          self?.captureStillOnSessionQueue(completion: completion)
        }
      }
      return
    default:
      completion(nil, CameraEffectError.sessionUnavailable("Camera permission denied"))
      return
    }

    configureAndRunOnSessionQueue()
    guard session.isRunning, photoOutput.connection(with: .video) != nil else {
      completion(nil, CameraEffectError.sessionUnavailable("Preview is not running"))
      return
    }

    let settings: AVCapturePhotoSettings
    if photoOutput.availablePhotoCodecTypes.contains(.jpeg) {
      settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
    } else {
      settings = AVCapturePhotoSettings()
    }
    if #available(iOS 16.0, *) {
      settings.photoQualityPrioritization = .quality
    }
    photoCompletions[Int64(settings.uniqueID)] = completion
    photoOutput.capturePhoto(with: settings, delegate: self)
  }

  private func saveToPhotoLibrary(
    _ data: Data,
    completion: @escaping (String?, Error?) -> Void
  ) {
    let write = {
      var placeholder: PHObjectPlaceholder?
      PHPhotoLibrary.shared().performChanges({
        let request = PHAssetCreationRequest.forAsset()
        request.addResource(with: .photo, data: data, options: nil)
        placeholder = request.placeholderForCreatedAsset
      }, completionHandler: { success, error in
        if let error {
          completion(nil, error)
          return
        }
        guard success else {
          completion(nil, CameraEffectError.applyFailed("Could not save to Photos"))
          return
        }
        completion(placeholder?.localIdentifier ?? "photos", nil)
      })
    }

    if #available(iOS 14, *) {
      switch PHPhotoLibrary.authorizationStatus(for: .addOnly) {
      case .authorized, .limited:
        write()
      case .notDetermined:
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
          if status == .authorized || status == .limited {
            write()
          } else {
            completion(nil, CameraEffectError.sessionUnavailable("Photos permission denied"))
          }
        }
      default:
        completion(nil, CameraEffectError.sessionUnavailable("Photos permission denied"))
      }
    } else {
      switch PHPhotoLibrary.authorizationStatus() {
      case .authorized:
        write()
      case .notDetermined:
        PHPhotoLibrary.requestAuthorization { status in
          if status == .authorized {
            write()
          } else {
            completion(nil, CameraEffectError.sessionUnavailable("Photos permission denied"))
          }
        }
      default:
        completion(nil, CameraEffectError.sessionUnavailable("Photos permission denied"))
      }
    }
  }

  private func finishPhoto(uniqueID: Int64, path: String?, error: Error?) {
    let completion = photoCompletions.removeValue(forKey: uniqueID)
    completion?(path, error)
  }
}

extension CameraSessionController: AVCapturePhotoCaptureDelegate {
  func photoOutput(
    _ output: AVCapturePhotoOutput,
    didFinishProcessingPhoto photo: AVCapturePhoto,
    error: Error?
  ) {
    let uniqueID = Int64(photo.resolvedSettings.uniqueID)
    sessionQueue.async { [weak self] in
      guard let self else { return }
      if let error {
        self.finishPhoto(uniqueID: uniqueID, path: nil, error: error)
        return
      }
      guard let data = photo.fileDataRepresentation() else {
        self.finishPhoto(
          uniqueID: uniqueID,
          path: nil,
          error: CameraEffectError.applyFailed("No still data")
        )
        return
      }
      self.saveToPhotoLibrary(data) { path, error in
        self.finishPhoto(uniqueID: uniqueID, path: path, error: error)
      }
    }
  }
}
