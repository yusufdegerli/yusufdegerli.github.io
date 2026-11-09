import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:vizor/app.dart';
import 'package:vizor/features/studio/studio_controller.dart';
import 'package:vizor/features/studio/widgets/effects_rail.dart';
import 'package:vizor/native/camera_effect.dart';

void main() {
  Future<void> pumpStudio(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const VizorApp());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 80));
  }

  testWidgets('Vizor studio shows brand and script', (tester) async {
    await pumpStudio(tester);

    expect(find.text('VIZOR'), findsOneWidget);
    expect(find.textContaining('THE LAST LIGHT'), findsOneWidget);
    expect(find.text('RHYTHM & PACING'), findsOneWidget);
    expect(find.text('35mm  T1.8'), findsOneWidget);
    expect(find.text('1.33:1'), findsOneWidget);
  });

  testWidgets('play starts the scene and pause stops it', (tester) async {
    await pumpStudio(tester);

    await tester.tap(find.byIcon(Icons.play_arrow_rounded));
    await tester.pump();
    expect(find.byIcon(Icons.pause_rounded), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 1200));
    expect(find.text('00:00:00'), findsNothing);

    await tester.tap(find.byIcon(Icons.pause_rounded));
    await tester.pump();
    expect(find.byIcon(Icons.play_arrow_rounded), findsOneWidget);
  });

  testWidgets('tapping a neighbouring line seeks the prompter', (tester) async {
    await pumpStudio(tester);

    await tester.tap(find.textContaining('A woman stands by a wooden table'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.textContaining('LIVE  ACTION'), findsOneWidget);
  });

  testWidgets('script library switches to the night scene', (tester) async {
    await pumpStudio(tester);

    await tester.tap(find.text('Script'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('What We Kept'), findsOneWidget);
    await tester.tap(find.text('What We Kept'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.textContaining('WHAT WE KEPT'), findsWidgets);
    expect(find.textContaining('INT. LIVING ROOM — NIGHT'), findsWidgets);
  });

  testWidgets('effects rail exposes native camera moves', (tester) async {
    await pumpStudio(tester);

    expect(find.text('STILL'), findsOneWidget);
    expect(find.text('DOLLY ZOOM'), findsOneWidget);
    expect(find.text('ROCK FOCUS'), findsOneWidget);
  });

  testWidgets('effect chips select immediately and keep the last tap', (tester) async {
    await pumpStudio(tester);

    await tester.tap(find.text('DOLLY ZOOM'));
    await tester.pump();
    var studio = tester.element(find.byType(EffectsRail)).read<StudioController>();
    expect(studio.activeEffect, CameraEffectId.dollyZoom);

    await tester.tap(find.text('ROCK FOCUS'));
    await tester.pump();
    studio = tester.element(find.byType(EffectsRail)).read<StudioController>();
    expect(studio.activeEffect, CameraEffectId.rockFocus);

    await tester.pump(nativeEffectDebounce);
    await tester.pump();
    ScaffoldMessenger.of(tester.element(find.byType(EffectsRail)))
        .hideCurrentSnackBar();
    await tester.pump();
  });
}
