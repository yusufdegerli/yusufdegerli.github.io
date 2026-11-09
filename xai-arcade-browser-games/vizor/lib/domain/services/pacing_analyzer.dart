import '../../theme/vizor_colors.dart';
import '../models/pacing_curve.dart';
import '../models/scene.dart';

/// Turns timed dialogue weights into smooth emotional curves.
class PacingAnalyzer {
  const PacingAnalyzer();

  PacingAnalysis analyze(Scene scene) {
    final totalMs = scene.totalDuration.inMilliseconds;
    if (totalMs <= 0 || scene.blocks.isEmpty) {
      return const PacingAnalysis(series: [], beats: []);
    }

    var cursor = 0;
    final tension = <PacingPoint>[];
    final intimacy = <PacingPoint>[];
    final silence = <PacingPoint>[];
    final beats = <double>[];

    for (final block in scene.blocks) {
      final start = cursor / totalMs;
      final mid = (cursor + block.duration.inMilliseconds / 2) / totalMs;
      tension.add(PacingPoint(mid, block.tension.clamp(0, 1)));
      intimacy.add(PacingPoint(mid, block.intimacy.clamp(0, 1)));
      silence.add(PacingPoint(mid, block.silence.clamp(0, 1)));
      beats.add(start);
      cursor += block.duration.inMilliseconds;
    }
    beats.add(1);

    return PacingAnalysis(
      series: [
        PacingSeries(
          id: 'tension',
          label: 'Tension',
          color: VizorColors.terracotta,
          points: _pad(tension),
        ),
        PacingSeries(
          id: 'intimacy',
          label: 'Intimacy',
          color: VizorColors.amber,
          points: _pad(intimacy),
        ),
        PacingSeries(
          id: 'silence',
          label: 'Silence',
          color: VizorColors.sage,
          points: _pad(silence),
        ),
      ],
      beats: beats,
    );
  }

  List<PacingPoint> _pad(List<PacingPoint> raw) {
    if (raw.isEmpty) return raw;
    return [
      PacingPoint(0, raw.first.value * 0.7),
      ...raw,
      PacingPoint(1, raw.last.value * 0.85),
    ];
  }
}
