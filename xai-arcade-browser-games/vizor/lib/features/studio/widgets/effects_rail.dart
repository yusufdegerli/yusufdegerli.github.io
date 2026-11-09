import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../native/camera_effect.dart';
import '../../../theme/vizor_colors.dart';
import '../studio_controller.dart';

/// Compact trigger strip for native camera strategies.
/// Chip selection updates immediately; the native call is debounced.
class EffectsRail extends StatefulWidget {
  const EffectsRail({super.key});

  @override
  State<EffectsRail> createState() => _EffectsRailState();
}

enum _NativeAction { fire, clear, still }

class _EffectsRailState extends State<EffectsRail> {
  static const _debounce = nativeEffectDebounce;

  Timer? _timer;
  _NativeAction? _action;
  CameraEffectId? _effect;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _schedule(_NativeAction action, {CameraEffectId? effect}) {
    _action = action;
    _effect = effect;
    _timer?.cancel();
    _timer = Timer(_debounce, _flush);
  }

  Future<void> _flush() async {
    if (!mounted) return;
    final action = _action;
    final effect = _effect;
    _action = null;
    _effect = null;
    if (action == null) return;

    switch (action) {
      case _NativeAction.fire:
        if (effect != null) await _commitFire(effect);
      case _NativeAction.clear:
        await _commitClear();
      case _NativeAction.still:
        await _commitStill();
    }
  }

  void _fire(CameraEffectId effect) {
    context.read<StudioController>().selectActiveEffect(effect);
    _schedule(_NativeAction.fire, effect: effect);
  }

  void _clear() {
    context.read<StudioController>().selectActiveEffect(null);
    _schedule(_NativeAction.clear);
  }

  void _still() {
    _schedule(_NativeAction.still);
  }

  Future<void> _commitFire(CameraEffectId effect) async {
    final studio = context.read<StudioController>();
    try {
      await studio.applyCameraEffect(effect);
    } on MissingPluginException {
      if (mounted) _toast('Native effects run on an iOS device.');
    } on PlatformException catch (e) {
      if (mounted) _toast(e.message ?? 'Effect failed');
    }
  }

  Future<void> _commitStill() async {
    final studio = context.read<StudioController>();
    try {
      await studio.takeReferenceStill();
      if (!mounted) return;
      _toast('Saved to Photos');
    } on MissingPluginException {
      if (mounted) _toast('Stills capture runs on an iOS device.');
    } on PlatformException catch (e) {
      if (mounted) _toast(e.message ?? 'Still failed');
    }
  }

  Future<void> _commitClear() async {
    final studio = context.read<StudioController>();
    try {
      await studio.clearCameraEffect();
    } on MissingPluginException {
      if (mounted) _toast('Native effects run on an iOS device.');
    } on PlatformException catch (e) {
      if (mounted) _toast(e.message ?? 'Clear failed');
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: VizorColors.walnut,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final studio = context.watch<StudioController>();

    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 2),
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: _StillButton(
              busy: studio.capturingStill,
              onTap: _still,
            ),
          ),
          for (final effect in CameraEffectId.values)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _FxChip(
                label: effect.label,
                selected: studio.activeEffect == effect,
                onTap: () => _fire(effect),
              ),
            ),
          _FxChip(
            label: 'Clear',
            selected: studio.activeEffect == null,
            onTap: _clear,
          ),
        ],
      ),
    );
  }
}

class _StillButton extends StatelessWidget {
  const _StillButton({required this.busy, required this.onTap});

  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Take photo',
      child: GestureDetector(
        onTap: busy ? null : onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: VizorColors.terracotta,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (busy)
                const SizedBox(
                  width: 10,
                  height: 10,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.4,
                    color: VizorColors.espresso,
                  ),
                )
              else
                const Icon(Icons.camera_alt_outlined, size: 12, color: VizorColors.espresso),
              const SizedBox(width: 6),
              Text(
                'STILL',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: VizorColors.espresso,
                      fontSize: 10,
                      letterSpacing: 1.1,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FxChip extends StatelessWidget {
  const _FxChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: selected ? VizorColors.amber : VizorColors.walnut,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: selected ? VizorColors.amber : VizorColors.line,
            ),
          ),
          child: Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: selected ? VizorColors.espresso : VizorColors.honey,
                  fontSize: 10,
                  letterSpacing: 1.1,
                ),
          ),
        ),
      ),
    );
  }
}
