import 'package:flutter/material.dart';

import '../../theme/vizor_colors.dart';
import 'widgets/camera_viewfinder.dart';
import 'widgets/effects_rail.dart';
import 'widgets/pacing_graph.dart';
import 'widgets/script_prompter.dart';
import 'widgets/studio_chrome.dart';

class StudioScreen extends StatelessWidget {
  const StudioScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final framed = size.shortestSide > 520;

    if (!framed) {
      return const ColoredBox(
        color: VizorColors.espresso,
        child: _StudioBody(),
      );
    }

    final studio = DecoratedBox(
      decoration: BoxDecoration(
        color: VizorColors.espresso,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: VizorColors.bark, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: 40,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: const ClipRRect(
        borderRadius: BorderRadius.all(Radius.circular(28)),
        child: _StudioBody(),
      ),
    );

    return ColoredBox(
      color: const Color(0xFF070504),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420, maxHeight: 880),
          child: studio,
        ),
      ),
    );
  }
}

class _StudioBody extends StatelessWidget {
  const _StudioBody();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: VizorColors.espresso,
      body: SafeArea(
        child: Column(
          children: [
            StudioTopBar(),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: CameraViewfinder(),
            ),
            EffectsRail(),
            Expanded(
              child: ClipRect(child: ScriptPrompter()),
            ),
            PacingPanel(),
            StudioBottomBar(),
          ],
        ),
      ),
    );
  }
}
