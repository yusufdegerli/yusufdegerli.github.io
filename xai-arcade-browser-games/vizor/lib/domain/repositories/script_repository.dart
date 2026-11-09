import '../models/scene.dart';

/// Script storage. Local today; a remote client can implement the same surface.
abstract class ScriptRepository {
  Future<List<Scene>> loadScenes();
  Future<Scene> loadActiveScene();
  Future<Scene> selectScene(String id);
  Future<Scene> importScene(Scene scene);
}
