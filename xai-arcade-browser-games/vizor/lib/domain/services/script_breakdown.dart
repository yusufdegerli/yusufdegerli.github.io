import '../models/scene.dart';
import 'screenplay_parser.dart';
import 'spacexai_breakdown.dart';

enum BreakdownSource { local, spacexai }

class BreakdownResult {
  const BreakdownResult(this.scene, this.source);

  final Scene scene;
  final BreakdownSource source;
}

/// Prefers SpaceXAI when a key is present; always falls back to the local parser.
class ScriptBreakdown {
  const ScriptBreakdown({
    this.parser = const ScreenplayParser(),
    this.ai,
  });

  final ScreenplayParser parser;
  final SpaceXaiBreakdown? ai;

  bool get aiAvailable => ai?.isConfigured ?? false;

  Future<BreakdownResult> fromScreenplay(String text) async {
    final client = ai;
    if (client != null && client.isConfigured) {
      try {
        final scene = await client.breakdown(text);
        return BreakdownResult(scene, BreakdownSource.spacexai);
      } catch (_) {
        // Offline or bad key — local parser still ships a usable scene.
      }
    }
    return BreakdownResult(parser.parse(text), BreakdownSource.local);
  }
}
