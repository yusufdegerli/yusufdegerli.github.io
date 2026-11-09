/// Optical preset shown in the viewfinder HUD.
class LensProfile {
  const LensProfile({
    required this.focalLengthMm,
    required this.aperture,
    required this.crop,
    required this.vignette,
  });

  final int focalLengthMm;
  final String aperture;

  /// Digital crop used to simulate a tighter lens on a fixed plate.
  final double crop;

  /// Extra edge falloff for longer glass.
  final double vignette;

  String get label => '${focalLengthMm}mm';

  static const presets = <LensProfile>[
    LensProfile(focalLengthMm: 24, aperture: 'T2.0', crop: 1.00, vignette: 0.18),
    LensProfile(focalLengthMm: 35, aperture: 'T1.8', crop: 1.10, vignette: 0.28),
    LensProfile(focalLengthMm: 50, aperture: 'T1.4', crop: 1.28, vignette: 0.38),
    LensProfile(focalLengthMm: 85, aperture: 'T1.8', crop: 1.55, vignette: 0.48),
  ];
}

class AspectProfile {
  const AspectProfile({required this.label, required this.ratio});

  final String label;
  final double ratio;

  static const presets = <AspectProfile>[
    AspectProfile(label: '1.33:1', ratio: 4 / 3),
    AspectProfile(label: '16:9', ratio: 16 / 9),
    AspectProfile(label: '1.85:1', ratio: 1.85),
    AspectProfile(label: '2.39:1', ratio: 2.39),
  ];
}
