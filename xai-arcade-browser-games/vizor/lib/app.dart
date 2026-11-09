import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'data/local_script_repository.dart';
import 'domain/services/script_breakdown.dart';
import 'domain/services/spacexai_breakdown.dart';
import 'features/studio/studio_controller.dart';
import 'features/studio/studio_screen.dart';
import 'theme/vizor_theme.dart';

class VizorApp extends StatelessWidget {
  const VizorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => StudioController(
        repository: LocalScriptRepository(),
        breakdown: ScriptBreakdown(ai: SpaceXaiBreakdown()),
      )..load(),
      child: MaterialApp(
        title: 'Vizor',
        debugShowCheckedModeBanner: false,
        theme: VizorTheme.dark,
        home: const StudioScreen(),
      ),
    );
  }
}
