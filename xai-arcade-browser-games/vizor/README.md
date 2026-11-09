# Vizor

A local-first mobile filmmaking studio. Split-screen camera, teleprompter
script, and a live rhythm & pacing graph — built for a set, not a desk.

## Why local-first

Camera, prompter, and the live timer cannot depend on a network. Film sets
lose wifi. The studio talks only to a `ScriptRepository`; today's
implementation is `LocalScriptRepository` (bundled scene JSON in Dart). A
remote client — sync, multi-user scripts, cloud breakdown — can implement
the same interface later without touching the UI.

Pacing is computed on device from timed dialogue weights (tension, intimacy,
silence). Paste a Fountain-style draft from **Script → Paste a script**.
Breakdown always runs locally. If you pass a SpaceXAI key it will try
`grok-4.6` first and fall back on-device if the set is offline:

```sh
flutter run --dart-define=XAI_API_KEY=$XAI_API_KEY
```

## Run

```sh
flutter pub get
flutter run
```

iOS, Android, or Chrome. On a wide display the studio sits in a phone frame.

## Studio

- Top: 16:9 living-room plate with a 35mm / aspect overlay
- Middle: scrolling English prompter
- Bottom: rhythm graph + live block timer
- Play starts the scene clock; tap a line or drag the graph to seek
- Camera opens set plate / live camera, plus lens and aspect presets
- Script opens the scene library (The Last Light, What We Kept) and paste-to-breakdown
- The FX rail under the viewfinder drives native iOS camera strategies
  (Dolly Zoom, Rock Focus, Dutch Angle, Steadicam, …) through one
  MethodChannel: `com.yusufdegerli.vizor/camera`

### Adding a native camera effect

1. Create `ios/Runner/Camera/Effects/YourEffect.swift` conforming to `CameraEffectStrategy`
2. Register it with one line in `CameraEffectRegistry.bootstrap()`
3. Add a `CameraEffectId` on the Dart side

AppDelegate does not switch on effect names.
