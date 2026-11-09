import Flutter
import Foundation

/// Translates MethodChannel calls into session commands.
/// Method names are switched here; effect types are not.
enum CameraChannelHandler {
  static func handle(
    call: FlutterMethodCall,
    result: @escaping FlutterResult,
    session: CameraSessionController
  ) {
    do {
      switch call.method {
      case "setEffect":
        let parsed = try CameraEffectParams.parse(call.arguments)
        session.apply(effectType: parsed.effectType, params: parsed.params) { error in
          complete(
            result,
            error: error,
            payload: [
              "ok": true,
              "effectType": parsed.effectType,
              "message": "applied",
            ]
          )
        }
      case "clearEffect":
        session.clearEffect { error in
          complete(
            result,
            error: error,
            payload: ["ok": true, "effectType": NSNull(), "message": "cleared"]
          )
        }
      case "availableEffects":
        result(CameraEffectRegistry.knownTypes)
      case "startSession":
        session.start()
        result(["ok": true, "message": "started"])
      case "stopSession":
        session.stop()
        result(["ok": true, "message": "stopped"])
      case "takePhoto":
        session.takePhoto { path, error in
          if let error = error as? CameraEffectError {
            result(FlutterError(code: error.code, message: error.errorDescription, details: nil))
          } else if let error {
            result(FlutterError(code: "capture_failed", message: error.localizedDescription, details: nil))
          } else if let path, !path.isEmpty {
            result(["ok": true, "path": path, "message": "captured"])
          } else {
            result(FlutterError(code: "capture_failed", message: "No still path returned", details: nil))
          }
        }
      default:
        result(FlutterMethodNotImplemented)
      }
    } catch let error as CameraEffectError {
      complete(result, error: error, payload: [:])
    } catch {
      complete(result, error: error, payload: [:])
    }
  }
}

/// Always one `result` call. Safe from session-queue completions.
private func complete(
  _ result: @escaping FlutterResult,
  error: Error?,
  payload: [String: Any]
) {
  if let error = error as? CameraEffectError {
    result(FlutterError(code: error.code, message: error.errorDescription, details: nil))
  } else if let error {
    result(FlutterError(code: "apply_failed", message: error.localizedDescription, details: nil))
  } else {
    result(payload)
  }
}
