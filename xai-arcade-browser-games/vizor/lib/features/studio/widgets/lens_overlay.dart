import 'package:flutter/material.dart';

import '../../../domain/models/lens_profile.dart';
import '../../../theme/vizor_colors.dart';

/// Illustrative lens / aspect HUD drawn over the live plate.
class LensOverlay extends StatelessWidget {
  const LensOverlay({
    super.key,
    required this.lens,
    required this.aspect,
    required this.recording,
    required this.onLensTap,
    required this.onAspectTap,
    this.sourceLabel = 'SET',
  });

  final LensProfile lens;
  final AspectProfile aspect;
  final bool recording;
  final VoidCallback onLensTap;
  final VoidCallback onAspectTap;
  final String sourceLabel;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final frame = _aspectRect(size, aspect.ratio);

        return Stack(
          fit: StackFit.expand,
          children: [
            CustomPaint(
              painter: _ViewfinderPainter(
                frame: frame,
                vignette: lens.vignette,
                fullFrame: aspect.ratio >= 1.7 && aspect.ratio <= 1.8,
              ),
            ),
            Positioned(
              top: 10,
              left: 12,
              child: _RecChip(live: recording),
            ),
            Positioned(
              top: 12,
              right: 12,
              child: _HudText('$sourceLabel  ·  4K  ·  24fps'),
            ),
            Positioned(
              left: 12,
              bottom: 12,
              child: _HudButton(
                text: '${lens.label}  ${lens.aperture}',
                onTap: onLensTap,
              ),
            ),
            Positioned(
              right: 12,
              bottom: 12,
              child: _HudButton(
                text: aspect.label,
                onTap: onAspectTap,
              ),
            ),
          ],
        );
      },
    );
  }

  Rect _aspectRect(Size size, double ratio) {
    final view = size.width / size.height;
    if ((view - ratio).abs() < 0.02) {
      return Offset.zero & size;
    }
    if (ratio > view) {
      final h = size.width / ratio;
      return Rect.fromLTWH(0, (size.height - h) / 2, size.width, h);
    }
    final w = size.height * ratio;
    return Rect.fromLTWH((size.width - w) / 2, 0, w, size.height);
  }
}

class _ViewfinderPainter extends CustomPainter {
  _ViewfinderPainter({
    required this.frame,
    required this.vignette,
    required this.fullFrame,
  });

  final Rect frame;
  final double vignette;
  final bool fullFrame;

  @override
  void paint(Canvas canvas, Size size) {
    final bounds = Offset.zero & size;

    if (!fullFrame) {
      final dim = Path()
        ..addRect(bounds)
        ..addRect(frame)
        ..fillType = PathFillType.evenOdd;
      canvas.drawPath(dim, Paint()..color = const Color(0x99000000));
      canvas.drawRect(
        frame.deflate(0.5),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.8
          ..color = VizorColors.honey.withValues(alpha: 0.55),
      );
    }

    final shade = Paint()
      ..shader = RadialGradient(
        colors: [
          Colors.transparent,
          Colors.black.withValues(alpha: vignette),
        ],
        stops: const [0.45, 1],
      ).createShader(bounds);
    canvas.drawRect(bounds, shade);

    const arm = 18.0;
    final ink = Paint()
      ..color = VizorColors.cream.withValues(alpha: 0.88)
      ..strokeWidth = 1.4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.square;

    void corner(Offset o, double dx, double dy) {
      canvas.drawLine(o, o.translate(dx * arm, 0), ink);
      canvas.drawLine(o, o.translate(0, dy * arm), ink);
    }

    final r = frame.deflate(8);
    corner(r.topLeft, 1, 1);
    corner(r.topRight, -1, 1);
    corner(r.bottomLeft, 1, -1);
    corner(r.bottomRight, -1, -1);

    final c = frame.center;
    final hair = Paint()
      ..color = VizorColors.cream.withValues(alpha: 0.35)
      ..strokeWidth = 0.7;
    canvas.drawLine(c.translate(-7, 0), c.translate(7, 0), hair);
    canvas.drawLine(c.translate(0, -7), c.translate(0, 7), hair);
  }

  @override
  bool shouldRepaint(covariant _ViewfinderPainter old) =>
      old.frame != frame ||
      old.vignette != vignette ||
      old.fullFrame != fullFrame;
}

class _RecChip extends StatelessWidget {
  const _RecChip({required this.live});

  final bool live;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(
            color: live ? VizorColors.rec : VizorColors.dust,
            shape: BoxShape.circle,
            boxShadow: live
                ? [
                    BoxShadow(
                      color: VizorColors.rec.withValues(alpha: 0.7),
                      blurRadius: 6,
                    ),
                  ]
                : null,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          live ? 'REC' : 'STBY',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: live ? VizorColors.cream : VizorColors.mist,
                fontSize: 10,
              ),
        ),
      ],
    );
  }
}

class _HudText extends StatelessWidget {
  const _HudText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: VizorColors.cream.withValues(alpha: 0.85),
            shadows: const [Shadow(blurRadius: 6, color: Colors.black54)],
          ),
    );
  }
}

class _HudButton extends StatelessWidget {
  const _HudButton({required this.text, required this.onTap});

  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: VizorColors.honey.withValues(alpha: 0.35)),
        ),
        child: Text(
          text,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: VizorColors.honey,
                fontSize: 11,
              ),
        ),
      ),
    );
  }
}
