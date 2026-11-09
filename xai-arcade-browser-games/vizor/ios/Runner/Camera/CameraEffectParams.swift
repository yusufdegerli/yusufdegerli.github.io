import Foundation

/// Typed view over the Dart `Map<String, dynamic>` payload.
struct CameraEffectParams {
  let raw: [String: Any]

  init(_ raw: [String: Any] = [:]) {
    self.raw = raw
  }

  func double(_ key: String, default defaultValue: Double) -> Double {
    if let n = raw[key] as? NSNumber { return n.doubleValue }
    if let n = raw[key] as? Double { return n }
    if let n = raw[key] as? Int { return Double(n) }
    return defaultValue
  }

  func string(_ key: String, default defaultValue: String) -> String {
    (raw[key] as? String) ?? defaultValue
  }

  func bool(_ key: String, default defaultValue: Bool) -> Bool {
    if let b = raw[key] as? Bool { return b }
    if let n = raw[key] as? NSNumber { return n.boolValue }
    return defaultValue
  }

  func duration(_ key: String = "duration", default defaultValue: TimeInterval = 1.0) -> TimeInterval {
    max(0.01, double(key, default: defaultValue))
  }

  /// Pulls `{ effectType, params }` off a MethodChannel argument bag.
  static func parse(_ arguments: Any?) throws -> (effectType: String, params: CameraEffectParams) {
    guard let bag = arguments as? [String: Any] else {
      throw CameraEffectError.invalidPayload("Expected a JSON object")
    }
    guard let type = bag["effectType"] as? String, !type.isEmpty else {
      throw CameraEffectError.invalidPayload("Missing effectType")
    }
    let rawParams = bag["params"] as? [String: Any] ?? [:]
    return (type, CameraEffectParams(rawParams))
  }
}

enum CameraEffectError: LocalizedError {
  case invalidPayload(String)
  case unknownEffect(String)
  case sessionUnavailable(String)
  case applyFailed(String)

  var errorDescription: String? {
    switch self {
    case .invalidPayload(let m),
         .sessionUnavailable(let m),
         .applyFailed(let m):
      return m
    case .unknownEffect(let type):
      return "No CameraEffectStrategy registered for '\(type)'"
    }
  }

  var code: String {
    switch self {
    case .invalidPayload: return "invalid_payload"
    case .unknownEffect: return "unknown_effect"
    case .sessionUnavailable: return "session_unavailable"
    case .applyFailed: return "apply_failed"
    }
  }
}
