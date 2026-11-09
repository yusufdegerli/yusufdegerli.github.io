import 'package:flutter_test/flutter_test.dart';
import 'package:vizor/data/sample_scenes.dart';
import 'package:vizor/domain/services/pacing_analyzer.dart';
import 'package:vizor/features/studio/studio_controller.dart';
import 'package:vizor/data/local_script_repository.dart';

void main() {
  test('analyzer emits tension, intimacy, and silence curves', () {
    final analysis = const PacingAnalyzer().analyze(sampleLivingRoom);

    expect(analysis.series.map((s) => s.id), ['tension', 'intimacy', 'silence']);
    expect(analysis.series.every((s) => s.points.length >= 2), isTrue);
    expect(analysis.beats.first, 0);
    expect(analysis.beats.last, 1);
  });

  test('controller advances to the spoken block at a given time', () async {
    final studio = StudioController(repository: LocalScriptRepository());
    await studio.load();

    studio.seekToProgress(0);
    expect(studio.currentBlock?.kind.name, 'slug');

    studio.seekToBlock(2);
    expect(studio.currentBlock?.character, 'MARA');
    expect(studio.currentBlock?.text.contains('leave before the light'), isTrue);

    studio.seekToProgress(1);
    expect(studio.currentIndex, sampleLivingRoom.blocks.length - 1);
  });
}
