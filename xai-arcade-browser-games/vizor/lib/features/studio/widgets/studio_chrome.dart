import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../domain/models/lens_profile.dart';
import '../../../theme/vizor_colors.dart';
import '../studio_controller.dart';
import 'script_library_sheet.dart';

class StudioTopBar extends StatelessWidget {
  const StudioTopBar({super.key});

  @override
  Widget build(BuildContext context) {
    final studio = context.watch<StudioController>();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
      child: Row(
        children: [
          const _Mark(),
          const SizedBox(width: 10),
          Text('VIZOR', style: Theme.of(context).textTheme.titleLarge),
          const Spacer(),
          Text(
            _fmt(studio.elapsed),
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: VizorColors.honey,
                  fontSize: 13,
                ),
          ),
        ],
      ),
    );
  }

  String _fmt(Duration d) {
    final h = d.inHours.toString().padLeft(2, '0');
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }
}

class _Mark extends StatelessWidget {
  const _Mark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: VizorColors.amber.withValues(alpha: 0.7)),
        color: VizorColors.walnut,
      ),
      alignment: Alignment.center,
      child: Text(
        'V',
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: VizorColors.honey,
              fontSize: 16,
              height: 1,
            ),
      ),
    );
  }
}

class StudioBottomBar extends StatelessWidget {
  const StudioBottomBar({super.key});

  @override
  Widget build(BuildContext context) {
    final studio = context.watch<StudioController>();

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Semantics(
            button: true,
            label: 'Camera',
            child: _NavIcon(
              icon: Icons.videocam_outlined,
              label: 'Camera',
              selected: studio.bottomTab == StudioTab.camera,
              onTap: () {
                studio.selectTab(StudioTab.camera);
                _showLensSheet(context);
              },
            ),
          ),
          _NavIcon(
            icon: Icons.schedule,
            label: 'Time',
            selected: studio.bottomTab == StudioTab.time,
            onTap: () {
              studio.selectTab(StudioTab.time);
              studio.reset();
            },
          ),
          Semantics(
            button: true,
            label: studio.playing ? 'Pause scene' : 'Play scene',
            child: _PlayButton(
              playing: studio.playing,
              onTap: studio.togglePlay,
            ),
          ),
          Semantics(
            button: true,
            label: 'Script',
            child: _NavIcon(
              icon: Icons.menu_book_outlined,
              label: 'Script',
              selected: studio.bottomTab == StudioTab.script,
              onTap: () => showScriptLibrary(context),
            ),
          ),
          _NavIcon(
            icon: Icons.crop_free,
            label: 'Ratio',
            selected: false,
            onTap: studio.cycleAspect,
          ),
        ],
      ),
    );
  }

  void _showLensSheet(BuildContext context) {
    final studio = context.read<StudioController>();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: VizorColors.cocoa,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return ListenableBuilder(
          listenable: studio,
          builder: (context, _) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                        color: VizorColors.bark,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text('SOURCE', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _Chip(
                        label: 'SET PLATE',
                        selected: studio.cameraSource == CameraSource.setPlate,
                        onTap: () => studio.setCameraSource(CameraSource.setPlate),
                      ),
                      _Chip(
                        label: 'LIVE CAMERA',
                        selected: studio.cameraSource == CameraSource.live,
                        onTap: () => studio.setCameraSource(CameraSource.live),
                      ),
                    ],
                  ),
                  if (studio.cameraError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      studio.cameraError!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: VizorColors.terracotta,
                          ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  Text('LENS', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final lens in LensProfile.presets)
                        _Chip(
                          label: '${lens.label}  ${lens.aperture}',
                          selected: identical(lens, studio.lens) ||
                              lens.focalLengthMm == studio.lens.focalLengthMm,
                          onTap: () => studio.selectLens(lens),
                        ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Text('ASPECT', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final aspect in AspectProfile.presets)
                        _Chip(
                          label: aspect.label,
                          selected: aspect.label == studio.aspect.label,
                          onTap: () => studio.selectAspect(aspect),
                        ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? VizorColors.amber : VizorColors.walnut,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? VizorColors.amber : VizorColors.line,
          ),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: selected ? VizorColors.espresso : VizorColors.honey,
                fontSize: 11,
              ),
        ),
      ),
    );
  }
}

class _NavIcon extends StatelessWidget {
  const _NavIcon({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? VizorColors.honey : VizorColors.dust;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 3),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: color,
                    fontSize: 10,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlayButton extends StatelessWidget {
  const _PlayButton({required this.playing, required this.onTap});

  final bool playing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: VizorColors.amber,
          boxShadow: [
            BoxShadow(
              color: VizorColors.amber.withValues(alpha: 0.35),
              blurRadius: 16,
            ),
          ],
        ),
        child: Icon(
          playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
          color: VizorColors.espresso,
          size: 32,
        ),
      ),
    );
  }
}
