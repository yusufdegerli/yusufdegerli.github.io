import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../theme/vizor_colors.dart';
import '../studio_controller.dart';

Future<void> showScriptLibrary(BuildContext context) {
  final studio = context.read<StudioController>();
  studio.selectTab(StudioTab.script);
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: VizorColors.cocoa,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const ScriptLibrarySheet(),
  );
}

class ScriptLibrarySheet extends StatelessWidget {
  const ScriptLibrarySheet({super.key});

  @override
  Widget build(BuildContext context) {
    final studio = context.watch<StudioController>();
    final height = MediaQuery.sizeOf(context).height * 0.72;

    return SizedBox(
      height: height,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
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
            Text('SCRIPTS', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              'Switch a scene or paste a new shooting script.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 14),
            Expanded(
              child: ListView.separated(
                itemCount: studio.scenes.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final scene = studio.scenes[i];
                  final selected = scene.id == studio.scene?.id;
                  return Material(
                    color: selected ? VizorColors.walnut : VizorColors.espresso,
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () async {
                        await studio.openScene(scene.id);
                        if (context.mounted) Navigator.of(context).pop();
                      },
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    scene.title,
                                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                          fontSize: 16,
                                          color: VizorColors.cream,
                                        ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    scene.slugline,
                                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                          color: VizorColors.dust,
                                          letterSpacing: 0.6,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              _fmt(scene.totalDuration),
                              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: VizorColors.honey,
                                  ),
                            ),
                            if (selected) ...[
                              const SizedBox(width: 8),
                              const Icon(Icons.check_circle, size: 18, color: VizorColors.amber),
                            ],
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: VizorColors.honey,
                side: const BorderSide(color: VizorColors.line),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: () {
                Navigator.of(context).pop();
                showBreakdownSheet(context);
              },
              icon: const Icon(Icons.playlist_add, size: 18),
              label: const Text('PASTE A SCRIPT'),
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

Future<void> showBreakdownSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: VizorColors.cocoa,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const BreakdownSheet(),
  );
}

class BreakdownSheet extends StatefulWidget {
  const BreakdownSheet({super.key});

  @override
  State<BreakdownSheet> createState() => _BreakdownSheetState();
}

class _BreakdownSheetState extends State<BreakdownSheet> {
  final _text = TextEditingController(text: _sampleDraft);
  String? _error;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final draft = _text.text.trim();
    if (draft.isEmpty) {
      setState(() => _error = 'Paste a scene first.');
      return;
    }
    final studio = context.read<StudioController>();
    try {
      await studio.importScreenplay(draft);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      setState(() => _error = 'Could not break that down.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final studio = context.watch<StudioController>();
    final inset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + inset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
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
          Text('BREAK DOWN', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            studio.aiBreakdownAvailable
                ? 'SpaceXAI will time and weight the scene. Falls back on-device if offline.'
                : 'Parsed on-device. Add --dart-define=XAI_API_KEY=… for SpaceXAI.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _text,
            maxLines: 10,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: VizorColors.cream,
                  height: 1.4,
                ),
            decoration: InputDecoration(
              filled: true,
              fillColor: VizorColors.espresso,
              hintText: 'INT. LIVING ROOM — NIGHT\n\nMARA\nWe missed it.',
              hintStyle: Theme.of(context).textTheme.bodySmall,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: VizorColors.line),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: VizorColors.line),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: VizorColors.terracotta, fontSize: 12)),
          ],
          const SizedBox(height: 12),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: VizorColors.amber,
              foregroundColor: VizorColors.espresso,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: studio.breakingDown ? null : _submit,
            child: studio.breakingDown
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(studio.aiBreakdownAvailable ? 'BREAK DOWN WITH SPACEXAI' : 'BREAK DOWN ON DEVICE'),
          ),
        ],
      ),
    );
  }
}

const _sampleDraft = '''INT. KITCHEN — DAWN

A kettle ticks. Grey light at the window.

MARA
You packed the wrong suitcase.

ELIAS
(quiet)
I packed the one by the door.

MARA
That one was staying.''';
