import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../native/camera_effect.dart';
import '../../../theme/vizor_colors.dart';
import '../studio_controller.dart';

/// Follow-focus wheel over the viewfinder.
/// Local value updates immediately; native `setEffect` is debounced.
class FocusPullSlider extends StatefulWidget {
  const FocusPullSlider({super.key});

  @override
  State<FocusPullSlider> createState() => _FocusPullSliderState();
}

class _FocusPullSliderState extends State<FocusPullSlider> {
  static const _debounce = nativeEffectDebounce;

  late double _value;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _value = context.read<StudioController>().lensPosition;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _onChanged(double value) {
    setState(() => _value = value);
    _timer?.cancel();
    _timer = Timer(_debounce, () => _flush(value));
  }

  Future<void> _flush(double value) async {
    if (!mounted) return;
    final studio = context.read<StudioController>();
    try {
      await studio.setRockFocus(value);
    } on MissingPluginException {
      // Slider still moves locally; native focus only exists on iOS.
    } on PlatformException {
      // Keep the overlay responsive if a single setEffect fails.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      right: 4,
      top: 36,
      bottom: 40,
      width: 36,
      child: Column(
        children: [
          Text(
            'FOCUS',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: VizorColors.honey,
                  fontSize: 8,
                  letterSpacing: 1.2,
                  shadows: const [Shadow(blurRadius: 6, color: Colors.black54)],
                ),
          ),
          Expanded(
            child: RotatedBox(
              quarterTurns: 3,
              child: SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 2,
                  activeTrackColor: VizorColors.amber,
                  inactiveTrackColor: VizorColors.bark,
                  thumbColor: VizorColors.honey,
                  overlayColor: VizorColors.amber.withValues(alpha: 0.18),
                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                ),
                child: Slider(
                  value: _value,
                  onChanged: _onChanged,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
