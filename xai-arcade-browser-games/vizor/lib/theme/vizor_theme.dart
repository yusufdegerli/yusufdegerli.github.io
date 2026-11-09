import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'vizor_colors.dart';

abstract final class VizorTheme {
  static ThemeData get dark {
    final display = GoogleFonts.fraunces(
      color: VizorColors.cream,
      fontWeight: FontWeight.w500,
      height: 1.15,
    );
    final body = GoogleFonts.outfit(
      color: VizorColors.cream,
      fontWeight: FontWeight.w400,
      letterSpacing: 0.1,
    );
    final mono = GoogleFonts.ibmPlexMono(
      color: VizorColors.honey,
      fontWeight: FontWeight.w500,
      letterSpacing: 0.4,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: VizorColors.espresso,
      colorScheme: const ColorScheme.dark(
        surface: VizorColors.cocoa,
        primary: VizorColors.amber,
        onPrimary: VizorColors.espresso,
        secondary: VizorColors.honey,
        onSurface: VizorColors.cream,
      ),
      textTheme: TextTheme(
        displaySmall: display.copyWith(fontSize: 28),
        headlineMedium: display.copyWith(fontSize: 22),
        titleLarge: display.copyWith(fontSize: 18),
        titleMedium: body.copyWith(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          letterSpacing: 1.4,
          color: VizorColors.mist,
        ),
        bodyLarge: body.copyWith(fontSize: 18, height: 1.35),
        bodyMedium: body.copyWith(fontSize: 14, height: 1.4),
        bodySmall: body.copyWith(fontSize: 11, color: VizorColors.mist),
        labelSmall: mono.copyWith(fontSize: 10, letterSpacing: 1.6),
        labelMedium: mono.copyWith(fontSize: 12),
      ),
      iconTheme: const IconThemeData(color: VizorColors.honey, size: 20),
      dividerColor: VizorColors.line,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle.light,
      ),
    );
  }
}
