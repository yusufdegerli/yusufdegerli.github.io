/// Hold-off before a slider or effect chip talks to native hardware.
/// Local UI updates immediately; the MethodChannel call waits.
const nativeEffectDebounce = Duration(milliseconds: 80);

/// Catalog of native camera moves. Keep IDs in lockstep with
/// `CameraEffectRegistry` on iOS — adding an effect is a new value here
/// plus a new Swift strategy file.
enum CameraEffectId {
  dollyZoom('dollyZoom', 'Dolly Zoom'),
  rockFocus('rockFocus', 'Rock Focus'),
  dutchAngle('dutchAngle', 'Dutch Angle'),
  steadicam('steadicam', 'Steadicam'),
  shallowZoom('shallowZoom', 'Shallow Zoom'),
  focusZoom('focusZoom', 'Focus Zoom');

  const CameraEffectId(this.type, this.label);

  final String type;
  final String label;

  /// Default payload each button sends. Native strategies read only the
  /// keys they care about; extra keys are ignored.
  Map<String, dynamic> get defaultParams => switch (this) {
        CameraEffectId.dollyZoom => {
            'intensity': 0.75,
            'duration': 1.4,
            'direction': 'in',
            'easing': 'easeInOut',
          },
        CameraEffectId.rockFocus => {
            'targetLensPosition': 0.5,
          },
        CameraEffectId.dutchAngle => {
            'angle': 18.0,
            'duration': 0.6,
            'animated': true,
          },
        CameraEffectId.steadicam => {
            'strength': 0.65,
            'smoothing': 0.8,
          },
        CameraEffectId.shallowZoom => {
            'zoom': 1.6,
            'apertureBias': 0.2,
            'duration': 0.9,
          },
        CameraEffectId.focusZoom => {
            'zoom': 2.0,
            'lensPosition': 0.35,
            'duration': 1.1,
          },
      };
}
