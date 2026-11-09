import 'package:flutter/material.dart';

class PacingPoint {
  const PacingPoint(this.t, this.value);

  /// Normalized scene time, 0–1.
  final double t;
  final double value;
}

class PacingSeries {
  const PacingSeries({
    required this.id,
    required this.label,
    required this.color,
    required this.points,
  });

  final String id;
  final String label;
  final Color color;
  final List<PacingPoint> points;
}

class PacingAnalysis {
  const PacingAnalysis({required this.series, required this.beats});

  final List<PacingSeries> series;
  final List<double> beats;
}
