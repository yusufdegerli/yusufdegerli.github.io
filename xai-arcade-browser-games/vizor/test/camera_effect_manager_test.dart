import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vizor/native/camera_effect.dart';
import 'package:vizor/native/camera_effect_manager.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel(CameraEffectManager.channelName);
  final log = <MethodCall>[];

  setUp(() {
    log.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      log.add(call);
      if (call.method == 'availableEffects') {
        return ['dollyZoom', 'rockFocus', 'dutchAngle'];
      }
      if (call.method == 'takePhoto') {
        return {'ok': true, 'path': '/tmp/stills/vizor-still.jpg', 'message': 'captured'};
      }
      return {'ok': true, 'effectType': 'dollyZoom', 'message': 'applied'};
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('setEffect sends a standardized effectType + params payload', () async {
    final manager = CameraEffectManager(channel: channel);
    final ack = await manager.setEffect('dollyZoom', {
      'intensity': 0.75,
      'duration': 1.4,
    });

    expect(ack.ok, isTrue);
    expect(log, hasLength(1));
    expect(log.single.method, 'setEffect');
    expect(
      log.single.arguments,
      {
        'effectType': 'dollyZoom',
        'params': {'intensity': 0.75, 'duration': 1.4},
      },
    );
  });

  test('apply uses the catalog defaults for each move', () async {
    final manager = CameraEffectManager(channel: channel);
    await manager.apply(CameraEffectId.dutchAngle);

    final args = log.single.arguments as Map;
    expect(args['effectType'], 'dutchAngle');
    expect((args['params'] as Map)['angle'], 18.0);
  });

  test('rockFocus payload carries targetLensPosition', () async {
    final manager = CameraEffectManager(channel: channel);
    await manager.setEffect('rockFocus', {'targetLensPosition': 0.35});

    expect(log.single.method, 'setEffect');
    expect(
      log.single.arguments,
      {
        'effectType': 'rockFocus',
        'params': {'targetLensPosition': 0.35},
      },
    );
  });

  test('takePhoto returns the on-device still path', () async {
    final manager = CameraEffectManager(channel: channel);
    expect(await manager.takePhoto(), '/tmp/stills/vizor-still.jpg');
    expect(log.single.method, 'takePhoto');
  });

  test('availableEffects lists registered native strategies', () async {
    final manager = CameraEffectManager(channel: channel);
    expect(
      await manager.availableEffects(),
      ['dollyZoom', 'rockFocus', 'dutchAngle'],
    );
  });
}
