import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../domain/models/dialogue_block.dart';
import '../../domain/models/lens_profile.dart';
import '../../domain/models/pacing_curve.dart';
import '../../domain/models/scene.dart';
import '../../domain/repositories/script_repository.dart';
import '../../domain/services/pacing_analyzer.dart';
import '../../domain/services/script_breakdown.dart';
import '../../native/camera_effect.dart';
import '../../native/camera_effect_manager.dart';

enum CameraSource { setPlate, live }

class StudioController extends ChangeNotifier {
  StudioController({
    required ScriptRepository repository,
    PacingAnalyzer analyzer = const PacingAnalyzer(),
    ScriptBreakdown breakdown = const ScriptBreakdown(),
    CameraEffectManager? cameraEffects,
  })  : _repository = repository,
        _analyzer = analyzer,
        _breakdown = breakdown,
        _cameraEffects = cameraEffects ?? CameraEffectManager();

  final ScriptRepository _repository;
  final PacingAnalyzer _analyzer;
  final ScriptBreakdown _breakdown;
  final CameraEffectManager _cameraEffects;

  Scene? scene;
  List<Scene> scenes = const [];
  PacingAnalysis? analysis;
  var lens = LensProfile.presets[1]; // 35mm
  var aspect = AspectProfile.presets[0]; // 1.33:1
  var elapsed = Duration.zero;
  var playing = false;
  var currentIndex = 0;
  var bottomTab = StudioTab.script;
  var cameraSource = CameraSource.setPlate;
  var breakingDown = false;
  String? breakdownMessage;
  String? cameraError;
  CameraEffectId? activeEffect;
  var lensPosition = 0.5;
  String? lastStillPath;
  var capturingStill = false;

  Timer? _ticker;
  var _nativeEffectEpoch = 0;

  bool get aiBreakdownAvailable => _breakdown.aiAvailable;

  DialogueBlock? get currentBlock {
    final s = scene;
    if (s == null || s.blocks.isEmpty) return null;
    return s.blocks[currentIndex];
  }

  Duration get blockElapsed {
    final s = scene;
    if (s == null) return Duration.zero;
    return s.blockElapsed(elapsed, currentIndex);
  }

  Duration get blockDuration => currentBlock?.duration ?? Duration.zero;

  double get sceneProgress {
    final total = scene?.totalDuration.inMilliseconds ?? 0;
    if (total == 0) return 0;
    return (elapsed.inMilliseconds / total).clamp(0.0, 1.0);
  }

  double get blockProgress {
    final total = blockDuration.inMilliseconds;
    if (total == 0) return 0;
    return (blockElapsed.inMilliseconds / total).clamp(0.0, 1.0);
  }

  Future<void> load() async {
    scenes = await _repository.loadScenes();
    scene = await _repository.loadActiveScene();
    analysis = _analyzer.analyze(scene!);
    elapsed = Duration.zero;
    currentIndex = 0;
    notifyListeners();
  }

  Future<void> openScene(String id) async {
    pause();
    scene = await _repository.selectScene(id);
    scenes = await _repository.loadScenes();
    analysis = _analyzer.analyze(scene!);
    elapsed = Duration.zero;
    currentIndex = 0;
    notifyListeners();
  }

  Future<BreakdownResult> importScreenplay(String text) async {
    breakingDown = true;
    breakdownMessage = null;
    notifyListeners();
    try {
      final result = await _breakdown.fromScreenplay(text);
      await _repository.importScene(result.scene);
      scene = result.scene;
      scenes = await _repository.loadScenes();
      analysis = _analyzer.analyze(scene!);
      elapsed = Duration.zero;
      currentIndex = 0;
      breakdownMessage = result.source == BreakdownSource.spacexai
          ? 'Broken down with SpaceXAI'
          : 'Broken down on device';
      return result;
    } catch (e) {
      breakdownMessage = 'Could not break down that script.';
      rethrow;
    } finally {
      breakingDown = false;
      notifyListeners();
    }
  }

  void togglePlay() {
    if (playing) {
      pause();
    } else {
      play();
    }
  }

  void play() {
    if (scene == null) return;
    if (elapsed >= scene!.totalDuration) {
      elapsed = Duration.zero;
      currentIndex = 0;
    }
    playing = true;
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(milliseconds: 50), (_) {
      elapsed += const Duration(milliseconds: 50);
      final next = scene!.blockIndexAt(elapsed);
      if (next != currentIndex) currentIndex = next;
      if (elapsed >= scene!.totalDuration) {
        elapsed = scene!.totalDuration;
        currentIndex = scene!.blocks.length - 1;
        pause();
        return;
      }
      notifyListeners();
    });
    notifyListeners();
  }

  void pause() {
    playing = false;
    _ticker?.cancel();
    _ticker = null;
    notifyListeners();
  }

  void reset() {
    pause();
    elapsed = Duration.zero;
    currentIndex = 0;
    notifyListeners();
  }

  void seekToBlock(int index) {
    final s = scene;
    if (s == null || index < 0 || index >= s.blocks.length) return;
    currentIndex = index;
    elapsed = s.blockStart(index);
    notifyListeners();
  }

  void seekToProgress(double t) {
    final s = scene;
    if (s == null) return;
    final ms = (s.totalDuration.inMilliseconds * t.clamp(0.0, 1.0)).round();
    elapsed = Duration(milliseconds: ms);
    currentIndex = s.blockIndexAt(elapsed);
    notifyListeners();
  }

  void cycleLens() {
    final i = LensProfile.presets.indexOf(lens);
    lens = LensProfile.presets[(i + 1) % LensProfile.presets.length];
    notifyListeners();
  }

  void selectLens(LensProfile next) {
    lens = next;
    notifyListeners();
  }

  void selectAspect(AspectProfile next) {
    aspect = next;
    notifyListeners();
  }

  void cycleAspect() {
    final i = AspectProfile.presets.indexWhere((a) => a.label == aspect.label);
    aspect = AspectProfile.presets[(i + 1) % AspectProfile.presets.length];
    notifyListeners();
  }

  void selectTab(StudioTab tab) {
    bottomTab = tab;
    notifyListeners();
  }

  void setCameraSource(CameraSource source) {
    cameraSource = source;
    if (source == CameraSource.setPlate) cameraError = null;
    notifyListeners();
  }

  void selectActiveEffect(CameraEffectId? effect) {
    if (activeEffect == effect) return;
    activeEffect = effect;
    notifyListeners();
  }

  Future<void> applyCameraEffect(CameraEffectId effect) async {
    if (effect == CameraEffectId.rockFocus) {
      await setRockFocus(lensPosition);
      return;
    }
    final epoch = ++_nativeEffectEpoch;
    activeEffect = effect;
    notifyListeners();
    final ack = await _cameraEffects.apply(effect);
    if (epoch != _nativeEffectEpoch) return;
    if (!ack.ok) {
      cameraError = ack.message;
      notifyListeners();
    }
  }

  Future<void> setRockFocus(double position) async {
    final epoch = ++_nativeEffectEpoch;
    lensPosition = position.clamp(0.0, 1.0);
    activeEffect = CameraEffectId.rockFocus;
    notifyListeners();
    final ack = await _cameraEffects.setEffect(
      CameraEffectId.rockFocus.type,
      {'targetLensPosition': lensPosition},
    );
    if (epoch != _nativeEffectEpoch) return;
    if (!ack.ok) {
      cameraError = ack.message;
      notifyListeners();
    }
  }

  Future<void> clearCameraEffect() async {
    final epoch = ++_nativeEffectEpoch;
    activeEffect = null;
    notifyListeners();
    await _cameraEffects.clearEffect();
    if (epoch != _nativeEffectEpoch) return;
  }

  Future<String> takeReferenceStill() async {
    capturingStill = true;
    notifyListeners();
    try {
      await _cameraEffects.startSession();
      final path = await _cameraEffects.takePhoto();
      lastStillPath = path;
      return path;
    } finally {
      capturingStill = false;
      notifyListeners();
    }
  }

  void reportCameraError(String? message) {
    cameraError = message;
    if (message != null) cameraSource = CameraSource.setPlate;
    notifyListeners();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }
}

enum StudioTab { camera, time, script }
