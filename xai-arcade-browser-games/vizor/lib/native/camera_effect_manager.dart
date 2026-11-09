import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'camera_effect.dart';

/// Single door from Dart into native camera moves.
///
/// One [MethodChannel] — `com.yusufdegerli.vizor/camera` — carries every
/// effect. iOS routes `effectType` through a strategy registry; Android/web
/// currently have no handler and surface [MissingPluginException].
class CameraEffectManager {
  CameraEffectManager({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel(channelName);

  static const channelName = 'com.yusufdegerli.vizor/camera';

  final MethodChannel _channel;

  /// Standardized payload: `{ effectType, params }`.
  Future<CameraEffectAck> setEffect(
    String effectType,
    Map<String, dynamic> params,
  ) async {
    final payload = <String, dynamic>{
      'effectType': effectType,
      'params': params,
    };
    final raw = await _channel.invokeMethod<dynamic>('setEffect', payload);
    return CameraEffectAck.from(raw);
  }

  Future<CameraEffectAck> apply(CameraEffectId effect) {
    return setEffect(effect.type, effect.defaultParams);
  }

  Future<CameraEffectAck> clearEffect() async {
    final raw = await _channel.invokeMethod<dynamic>('clearEffect');
    return CameraEffectAck.from(raw);
  }

  Future<List<String>> availableEffects() async {
    final raw = await _channel.invokeMethod<List<dynamic>>('availableEffects');
    return raw?.map((e) => e.toString()).toList() ?? const [];
  }

  Future<void> startSession() => _channel.invokeMethod<void>('startSession');

  Future<void> stopSession() => _channel.invokeMethod<void>('stopSession');

  /// Captures a reference still into the iOS Photo Library.
  /// Returns the Photos local identifier.
  Future<String> takePhoto() async {
    final raw = await _channel.invokeMethod<dynamic>('takePhoto');
    if (raw is String && raw.isNotEmpty) return raw;
    if (raw is Map) {
      final path = raw['path']?.toString();
      if (path != null && path.isNotEmpty) return path;
    }
    throw PlatformException(
      code: 'capture_failed',
      message: 'No still path returned',
    );
  }
}

class CameraEffectAck {
  const CameraEffectAck({
    required this.ok,
    this.effectType,
    this.message,
  });

  final bool ok;
  final String? effectType;
  final String? message;

  factory CameraEffectAck.from(dynamic raw) {
    if (raw is Map) {
      return CameraEffectAck(
        ok: raw['ok'] == true,
        effectType: raw['effectType']?.toString(),
        message: raw['message']?.toString(),
      );
    }
    return CameraEffectAck(ok: raw == true, message: raw?.toString());
  }
}

/// True when the host has no native camera channel (web, most tests).
bool isMissingCameraPlugin(Object error) =>
    error is MissingPluginException ||
    (error is PlatformException && error.code == 'unimplemented');

@visibleForTesting
Map<String, dynamic> effectPayload(
  String effectType,
  Map<String, dynamic> params,
) =>
    {'effectType': effectType, 'params': params};
