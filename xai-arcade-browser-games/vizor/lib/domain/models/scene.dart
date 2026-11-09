import 'dialogue_block.dart';

class Scene {
  const Scene({
    required this.id,
    required this.title,
    required this.slugline,
    required this.location,
    required this.tod,
    required this.blocks,
    this.plateAsset = 'assets/images/living_room.jpg',
    this.videoAsset,
  });

  final String id;
  final String title;
  final String slugline;
  final String location;
  final String tod;
  final List<DialogueBlock> blocks;
  final String plateAsset;
  final String? videoAsset;

  Duration get totalDuration => blocks.fold(
        Duration.zero,
        (sum, block) => sum + block.duration,
      );

  int blockIndexAt(Duration elapsed) {
    var cursor = Duration.zero;
    for (var i = 0; i < blocks.length; i++) {
      cursor += blocks[i].duration;
      if (elapsed < cursor) return i;
    }
    return blocks.isEmpty ? 0 : blocks.length - 1;
  }

  Duration blockElapsed(Duration sceneElapsed, int index) {
    var start = Duration.zero;
    for (var i = 0; i < index && i < blocks.length; i++) {
      start += blocks[i].duration;
    }
    final local = sceneElapsed - start;
    if (local.isNegative) return Duration.zero;
    final cap = blocks[index].duration;
    return local > cap ? cap : local;
  }

  Duration blockStart(int index) {
    var start = Duration.zero;
    for (var i = 0; i < index && i < blocks.length; i++) {
      start += blocks[i].duration;
    }
    return start;
  }
}
