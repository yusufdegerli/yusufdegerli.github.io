import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../domain/models/dialogue_block.dart';
import '../../../theme/vizor_colors.dart';
import '../studio_controller.dart';

/// Teleprompter: current line holds the frame, neighbors sit above and below.
class ScriptPrompter extends StatelessWidget {
  const ScriptPrompter({super.key});

  @override
  Widget build(BuildContext context) {
    final studio = context.watch<StudioController>();
    final scene = studio.scene;
    if (scene == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final index = studio.currentIndex;
    final blocks = scene.blocks;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SCENE  ·  ${scene.title.toUpperCase()}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 2),
              Text(
                scene.slugline,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: VizorColors.dust,
                      letterSpacing: 0.6,
                    ),
              ),
            ],
          ),
        ),
        Expanded(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 380),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            child: LayoutBuilder(
              key: ValueKey(blocks[index].id),
              builder: (context, constraints) {
                return SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 6, 24, 12),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: constraints.maxHeight),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (index > 0)
                          _BlockLine(
                            block: blocks[index - 1],
                            emphasis: _Emphasis.past,
                            onTap: () => studio.seekToBlock(index - 1),
                          ),
                        _BlockLine(
                          block: blocks[index],
                          emphasis: _Emphasis.current,
                          onTap: () => studio.seekToBlock(index),
                        ),
                        if (index + 1 < blocks.length)
                          _BlockLine(
                            block: blocks[index + 1],
                            emphasis: _Emphasis.next,
                            onTap: () => studio.seekToBlock(index + 1),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

enum _Emphasis { past, current, next }

class _BlockLine extends StatelessWidget {
  const _BlockLine({
    required this.block,
    required this.emphasis,
    required this.onTap,
  });

  final DialogueBlock block;
  final _Emphasis emphasis;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final current = emphasis == _Emphasis.current;
    final opacity = switch (emphasis) {
      _Emphasis.current => 1.0,
      _Emphasis.past => 0.28,
      _Emphasis.next => 0.42,
    };
    final dialogueSize = current ? 22.0 : 15.0;

    return Semantics(
      button: true,
      label: block.liveLabel,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Opacity(
          opacity: opacity,
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: current ? 12 : 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (block.kind == BlockKind.slug)
                  Text(
                    block.text,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: VizorColors.amber,
                      fontSize: current ? 13 : 11,
                      letterSpacing: 1.8,
                    ),
                  )
                else if (block.kind == BlockKind.action)
                  Text(
                    block.text,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: VizorColors.mist,
                      fontStyle: FontStyle.italic,
                      fontSize: current ? 16 : 13,
                      height: 1.45,
                    ),
                  )
                else ...[
                  if (block.character != null)
                    Text(
                      block.character!,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: VizorColors.honey,
                        fontSize: 11,
                        letterSpacing: 2.2,
                      ),
                    ),
                  if (block.parenthetical != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      '(${block.parenthetical})',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: VizorColors.dust,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    block.text,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: VizorColors.cream,
                      fontSize: dialogueSize,
                      height: 1.35,
                      fontWeight: current ? FontWeight.w500 : FontWeight.w400,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
