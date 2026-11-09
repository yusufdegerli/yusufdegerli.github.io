import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../domain/models/pacing_curve.dart';
import '../../../theme/vizor_colors.dart';
import '../studio_controller.dart';

class PacingPanel extends StatelessWidget {
  const PacingPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final studio = context.watch<StudioController>();
    final analysis = studio.analysis;
    final block = studio.currentBlock;
    if (analysis == null) return const SizedBox.shrink();

    return Container(
      height: 158,
      margin: const EdgeInsets.fromLTRB(12, 6, 12, 8),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: VizorColors.cocoa,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: VizorColors.line),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'RHYTHM & PACING',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontSize: 11,
                        letterSpacing: 1.6,
                      ),
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Align(
                  alignment: Alignment.centerRight,
                  child: _LiveTimer(
                    elapsed: studio.blockElapsed,
                    total: studio.blockDuration,
                    label: block?.liveLabel ?? '',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              for (final series in analysis.series) ...[
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: series.color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  series.label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontSize: 10,
                        color: VizorColors.dust,
                      ),
                ),
                const SizedBox(width: 10),
              ],
            ],
          ),
          const SizedBox(height: 8),
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) {
                void seek(Offset local) {
                  final width = constraints.maxWidth;
                  if (width <= 0) return;
                  studio.seekToProgress(
                    (local.dx / width).clamp(0.0, 1.0),
                  );
                }

                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onHorizontalDragUpdate: (d) => seek(d.localPosition),
                  onTapUp: (d) => seek(d.localPosition),
                  child: PacingGraph(
                    analysis: analysis,
                    progress: studio.sceneProgress,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveTimer extends StatelessWidget {
  const _LiveTimer({
    required this.elapsed,
    required this.total,
    required this.label,
  });

  final Duration elapsed;
  final Duration total;
  final String label;

  @override
  Widget build(BuildContext context) {
    return FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.centerRight,
      child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: VizorColors.walnut,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: VizorColors.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: VizorColors.amber,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label.isEmpty
                ? 'LIVE  ${_fmt(elapsed)} / ${_fmt(total)}'
                : 'LIVE  $label  ${_fmt(elapsed)} / ${_fmt(total)}',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: VizorColors.honey,
                  fontSize: 10,
                ),
          ),
        ],
      ),
      ),
    );
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }
}

class PacingGraph extends StatelessWidget {
  const PacingGraph({
    super.key,
    required this.analysis,
    required this.progress,
  });

  final PacingAnalysis analysis;
  final double progress;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _PacingPainter(analysis: analysis, progress: progress),
      child: const SizedBox.expand(),
    );
  }
}

class _PacingPainter extends CustomPainter {
  _PacingPainter({required this.analysis, required this.progress});

  final PacingAnalysis analysis;
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final chart = Rect.fromLTWH(0, 4, size.width, size.height - 8);

    final grid = Paint()
      ..color = VizorColors.line
      ..strokeWidth = 0.6;
    for (final beat in analysis.beats) {
      final x = chart.left + chart.width * beat;
      canvas.drawLine(Offset(x, chart.top), Offset(x, chart.bottom), grid);
    }

    for (final series in analysis.series) {
      final path = _spline(series.points, chart);
      if (path == null) continue;

      final fill = Path.from(path)
        ..lineTo(chart.right, chart.bottom)
        ..lineTo(chart.left, chart.bottom)
        ..close();
      canvas.drawPath(
        fill,
        Paint()..color = series.color.withValues(alpha: 0.10),
      );
      canvas.drawPath(
        path,
        Paint()
          ..color = series.color.withValues(alpha: 0.28)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 6
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
      );
      canvas.drawPath(
        path,
        Paint()
          ..color = series.color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
    }

    final x = chart.left + chart.width * progress;
    final playhead = Paint()
      ..color = VizorColors.honey
      ..strokeWidth = 1.2;
    canvas.drawLine(Offset(x, chart.top), Offset(x, chart.bottom), playhead);
    final diamond = Path()
      ..addPolygon([
        Offset(x, chart.top - 3),
        Offset(x + 4, chart.top + 2),
        Offset(x, chart.top + 7),
        Offset(x - 4, chart.top + 2),
      ], true);
    canvas.drawPath(diamond, Paint()..color = VizorColors.honey);
  }

  Path? _spline(List<PacingPoint> points, Rect chart) {
    if (points.length < 2) return null;
    final mapped = [
      for (final p in points)
        Offset(
          chart.left + chart.width * p.t,
          chart.bottom - chart.height * p.value,
        ),
    ];
    final path = Path()..moveTo(mapped.first.dx, mapped.first.dy);
    for (var i = 0; i < mapped.length - 1; i++) {
      final p0 = mapped[math.max(0, i - 1)];
      final p1 = mapped[i];
      final p2 = mapped[i + 1];
      final p3 = mapped[math.min(mapped.length - 1, i + 2)];
      final c1 = Offset(
        p1.dx + (p2.dx - p0.dx) / 6,
        p1.dy + (p2.dy - p0.dy) / 6,
      );
      final c2 = Offset(
        p2.dx - (p3.dx - p1.dx) / 6,
        p2.dy - (p3.dy - p1.dy) / 6,
      );
      path.cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, p2.dx, p2.dy);
    }
    return path;
  }

  @override
  bool shouldRepaint(covariant _PacingPainter old) =>
      old.progress != progress || old.analysis != analysis;
}
