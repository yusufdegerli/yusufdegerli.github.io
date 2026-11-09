import 'package:flutter_test/flutter_test.dart';
import 'package:vizor/data/local_script_repository.dart';
import 'package:vizor/data/sample_scenes.dart';
import 'package:vizor/domain/services/screenplay_parser.dart';
import 'package:vizor/domain/services/script_breakdown.dart';
import 'package:vizor/domain/services/spacexai_breakdown.dart';
import 'package:vizor/features/studio/studio_controller.dart';

void main() {
  const draft = '''
INT. KITCHEN — DAWN

A kettle ticks.

MARA
You packed the wrong suitcase.

ELIAS
(quiet)
I packed the one by the door.
''';

  test('parser splits slug, action, and attributed dialogue', () {
    final scene = const ScreenplayParser().parse(draft, id: 'test-kitchen');

    expect(scene.id, 'test-kitchen');
    expect(scene.slugline, contains('KITCHEN'));
    expect(scene.blocks.first.kind.name, 'slug');
    expect(scene.blocks[1].kind.name, 'action');
    expect(scene.blocks[2].character, 'MARA');
    expect(scene.blocks[3].character, 'ELIAS');
    expect(scene.blocks[3].parenthetical, 'quiet');
    expect(scene.blocks[3].text.contains('packed the one'), isTrue);
  });

  test('local breakdown is used when SpaceXAI is not configured', () async {
    final result = await const ScriptBreakdown().fromScreenplay(draft);
    expect(result.source, BreakdownSource.local);
    expect(result.scene.blocks.any((b) => b.character == 'MARA'), isTrue);
  });

  test('SpaceXAI JSON mapper builds a timed scene', () {
    const json = '''
{"title":"Dawn","slugline":"INT. KITCHEN — DAWN","location":"Kitchen","tod":"Dawn",
 "blocks":[{"kind":"dialogue","character":"MARA","parenthetical":null,
 "text":"You packed the wrong suitcase.","duration_ms":4000,"tension":0.6,"intimacy":0.5,"silence":0.2}]}
''';
    final scene = SpaceXaiBreakdown.sceneFromJson(json);
    expect(scene.title, 'Dawn');
    expect(scene.blocks.single.character, 'MARA');
    expect(scene.blocks.single.duration, const Duration(milliseconds: 4000));
  });

  test('controller can switch bundled scenes and import a draft', () async {
    final studio = StudioController(repository: LocalScriptRepository());
    await studio.load();
    expect(studio.scene?.id, sampleLivingRoom.id);
    expect(studio.scenes, hasLength(2));

    await studio.openScene(sampleNightRoom.id);
    expect(studio.scene?.title, 'What We Kept');
    expect(studio.currentIndex, 0);

    await studio.importScreenplay(draft);
    expect(studio.scene?.blocks.any((b) => b.character == 'MARA'), isTrue);
    expect(studio.scenes.length, 3);
  });
}
