import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../../theme/vizor_colors.dart';
import '../studio_controller.dart';
import 'focus_pull_slider.dart';
import 'lens_overlay.dart';

class CameraViewfinder extends StatefulWidget {
  const CameraViewfinder({super.key});

  @override
  State<CameraViewfinder> createState() => _CameraViewfinderState();
}

class _CameraViewfinderState extends State<CameraViewfinder> {
  VideoPlayerController? _player;
  CameraController? _camera;
  String? _platePath;
  String? _videoPath;
  var _videoReady = false;
  var _cameraReady = false;

  StudioController? _studio;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final studio = context.read<StudioController>();
    if (!identical(_studio, studio)) {
      _studio?.removeListener(_onStudio);
      _studio = studio;
      _studio!.addListener(_onStudio);
      _syncPlate();
    }
  }

  void _onStudio() {
    if (!mounted || _studio == null) return;
    _syncPlate();
    if (_studio!.cameraSource == CameraSource.live) {
      _ensureCamera();
    } else {
      _releaseCamera();
    }
  }

  Future<void> _syncPlate() async {
    final scene = _studio?.scene;
    if (scene == null) return;
    if (scene.plateAsset != _platePath) {
      _platePath = scene.plateAsset;
      if (mounted) setState(() {});
    }
    final video = scene.videoAsset;
    if (video == _videoPath) return;
    _videoPath = video;
    await _player?.dispose();
    _player = null;
    _videoReady = false;
    if (video == null) {
      if (mounted) setState(() {});
      return;
    }
    final player = VideoPlayerController.asset(video);
    try {
      await player.initialize();
      await player.setLooping(true);
      await player.setVolume(0);
      await player.play();
      if (!mounted) {
        await player.dispose();
        return;
      }
      setState(() {
        _player = player;
        _videoReady = true;
      });
    } catch (_) {
      await player.dispose();
      if (mounted) setState(() => _videoReady = false);
    }
  }

  Future<void> _ensureCamera() async {
    if (_cameraReady && _camera != null) return;
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        _studio?.reportCameraError('No camera on this device');
        return;
      }
      final chosen = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      final controller = CameraController(
        chosen,
        ResolutionPreset.high,
        enableAudio: false,
      );
      await controller.initialize();
      try {
        await controller.setFocusMode(FocusMode.auto);
        await controller.setExposureMode(ExposureMode.auto);
      } catch (_) {
        // Some devices reject AF/AE after init; preview still works.
      }
      if (!mounted || _studio?.cameraSource != CameraSource.live) {
        await controller.dispose();
        return;
      }
      setState(() {
        _camera = controller;
        _cameraReady = true;
      });
    } catch (e) {
      _studio?.reportCameraError('Camera unavailable');
    }
  }

  Future<void> _releaseCamera() async {
    final camera = _camera;
    if (camera == null && !_cameraReady) return;
    _camera = null;
    _cameraReady = false;
    await camera?.dispose();
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _studio?.removeListener(_onStudio);
    _player?.dispose();
    _camera?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final studio = context.watch<StudioController>();
    final live = studio.cameraSource == CameraSource.live && _cameraReady;
    final plate = studio.scene?.plateAsset ?? 'assets/images/living_room.jpg';

    return AspectRatio(
      aspectRatio: 16 / 9,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: ColoredBox(
          color: VizorColors.espresso,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Transform.scale(
                scale: studio.lens.crop,
                child: live && _camera != null
                    ? _LivePreview(controller: _camera!)
                    : _videoReady && _player != null
                        ? FittedBox(
                            fit: BoxFit.cover,
                            child: SizedBox(
                              width: _player!.value.size.width,
                              height: _player!.value.size.height,
                              child: VideoPlayer(_player!),
                            ),
                          )
                        : Image.asset(plate, fit: BoxFit.cover),
              ),
              LensOverlay(
                lens: studio.lens,
                aspect: studio.aspect,
                recording: studio.playing,
                sourceLabel: live ? 'LIVE' : 'SET',
                onLensTap: studio.cycleLens,
                onAspectTap: studio.cycleAspect,
              ),
              const FocusPullSlider(),
            ],
          ),
        ),
      ),
    );
  }
}

/// Fills the 16:9 well without stretching. Sensor buffers are landscape;
/// Flutter's [CameraPreview] is rotated in portrait, so we swap axes.
class _LivePreview extends StatelessWidget {
  const _LivePreview({required this.controller});

  final CameraController controller;

  @override
  Widget build(BuildContext context) {
    if (!controller.value.isInitialized) {
      return const SizedBox.expand();
    }
    final preview = controller.value.previewSize;
    final portrait = MediaQuery.orientationOf(context) == Orientation.portrait;
    final width = portrait
        ? (preview?.height ?? 1920)
        : (preview?.width ?? 1920);
    final height = portrait
        ? (preview?.width ?? 1080)
        : (preview?.height ?? 1080);

    return FittedBox(
      fit: BoxFit.cover,
      clipBehavior: Clip.hardEdge,
      child: SizedBox(
        width: width,
        height: height,
        child: CameraPreview(controller),
      ),
    );
  }
}
