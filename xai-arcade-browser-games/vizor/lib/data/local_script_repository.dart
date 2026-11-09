import '../domain/models/scene.dart';
import '../domain/repositories/script_repository.dart';
import 'sample_scenes.dart';

/// On-device script store. Swap this for a remote client later —
/// the studio only talks to [ScriptRepository].
class LocalScriptRepository implements ScriptRepository {
  LocalScriptRepository({List<Scene>? seed})
      : _scenes = List<Scene>.from(seed ?? const [sampleLivingRoom, sampleNightRoom]),
        _activeId = (seed ?? const [sampleLivingRoom, sampleNightRoom]).first.id;

  final List<Scene> _scenes;
  String _activeId;

  @override
  Future<List<Scene>> loadScenes() async => List.unmodifiable(_scenes);

  @override
  Future<Scene> loadActiveScene() async =>
      _scenes.firstWhere((s) => s.id == _activeId, orElse: () => _scenes.first);

  @override
  Future<Scene> selectScene(String id) async {
    final match = _scenes.where((s) => s.id == id);
    if (match.isEmpty) {
      throw StateError('Unknown scene: $id');
    }
    _activeId = id;
    return match.first;
  }

  @override
  Future<Scene> importScene(Scene scene) async {
    final existing = _scenes.indexWhere((s) => s.id == scene.id);
    if (existing >= 0) {
      _scenes[existing] = scene;
    } else {
      _scenes.add(scene);
    }
    _activeId = scene.id;
    return scene;
  }
}
