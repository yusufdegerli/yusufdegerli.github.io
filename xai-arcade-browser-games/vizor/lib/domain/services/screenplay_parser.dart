import '../models/dialogue_block.dart';
import '../models/scene.dart';

/// Fountain-ish screenplay → timed [Scene]. Always available offline.
class ScreenplayParser {
  const ScreenplayParser();

  static final _slug = RegExp(
    r'^(INT\.|EXT\.|INT/EXT\.|I/E\.)',
    caseSensitive: false,
  );
  static final _character = RegExp(
    r"^[A-Z][A-Z0-9 .\-']{1,36}(\s*\([^)]+\))?$",
  );

  Scene parse(String raw, {String? id}) {
    final lines = raw.replaceAll('\r\n', '\n').split('\n');
    final blocks = <DialogueBlock>[];
    String? pendingCharacter;
    String? pendingParen;
    final dialogueBuf = <String>[];

    void flushDialogue() {
      if (pendingCharacter == null || dialogueBuf.isEmpty) {
        pendingCharacter = null;
        pendingParen = null;
        dialogueBuf.clear();
        return;
      }
      final text = dialogueBuf.join(' ').trim();
      if (text.isNotEmpty) {
        blocks.add(
          _block(
            kind: BlockKind.dialogue,
            text: text,
            character: pendingCharacter,
            parenthetical: pendingParen,
          ),
        );
      }
      pendingCharacter = null;
      pendingParen = null;
      dialogueBuf.clear();
    }

    for (final original in lines) {
      final line = original.trim();
      if (line.isEmpty) {
        flushDialogue();
        continue;
      }

      if (_slug.hasMatch(line)) {
        flushDialogue();
        blocks.add(_block(kind: BlockKind.slug, text: line.toUpperCase()));
        continue;
      }

      if (pendingCharacter != null) {
        if (line.startsWith('(') && line.endsWith(')')) {
          pendingParen = line.substring(1, line.length - 1);
          continue;
        }
        dialogueBuf.add(line);
        continue;
      }

      if (_isCharacter(line)) {
        flushDialogue();
        final parenStart = line.indexOf('(');
        if (parenStart > 0) {
          pendingCharacter = line.substring(0, parenStart).trim();
          pendingParen = line
              .substring(parenStart + 1, line.endsWith(')') ? line.length - 1 : line.length)
              .trim();
        } else {
          pendingCharacter = line;
        }
        continue;
      }

      flushDialogue();
      blocks.add(_block(kind: BlockKind.action, text: line));
    }
    flushDialogue();

    if (blocks.isEmpty) {
      blocks.add(
        _block(kind: BlockKind.action, text: raw.trim().isEmpty ? 'Empty draft.' : raw.trim()),
      );
    }

    final slug = blocks.cast<DialogueBlock?>().firstWhere(
          (b) => b!.kind == BlockKind.slug,
          orElse: () => null,
        );
    final slugText = slug?.text ?? 'INT. SCENE — DAY';
    final parts = _splitSlug(slugText);

    return Scene(
      id: id ?? 'import-${DateTime.now().millisecondsSinceEpoch}',
      title: _titleFromSlug(slugText),
      slugline: slugText,
      location: parts.$1,
      tod: parts.$2,
      blocks: blocks,
    );
  }

  bool _isCharacter(String line) {
    if (line.length > 40) return false;
    if (_slug.hasMatch(line)) return false;
    if (line.endsWith('.')) return false;
    return _character.hasMatch(line);
  }

  DialogueBlock _block({
    required BlockKind kind,
    required String text,
    String? character,
    String? parenthetical,
  }) {
    final words = text.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
    final seconds = switch (kind) {
      BlockKind.slug => 3,
      BlockKind.action => (2 + (words * 0.38)).round().clamp(3, 12),
      BlockKind.dialogue || BlockKind.parenthetical =>
        (2 + (words * 0.42)).round().clamp(3, 14),
    };
    final lower = text.toLowerCase();
    final silenceCue = lower.contains('silence') ||
        lower.contains('pause') ||
        lower.contains('beat') ||
        lower.contains('dust');
    final tensionCue = lower.contains('leave') ||
        lower.contains('stay') ||
        lower.contains('afraid') ||
        lower.contains('never') ||
        lower.contains('miss');
    final intimacyCue = kind == BlockKind.dialogue ||
        lower.contains('hand') ||
        lower.contains('softer') ||
        lower.contains('smile');

    return DialogueBlock(
      id: 'b-${text.hashCode.abs()}',
      kind: kind,
      text: text,
      character: character,
      parenthetical: parenthetical,
      duration: Duration(seconds: seconds),
      tension: (kind == BlockKind.dialogue ? 0.42 : 0.28) + (tensionCue ? 0.28 : 0),
      intimacy: (intimacyCue ? 0.62 : 0.32) + (kind == BlockKind.dialogue ? 0.12 : 0),
      silence: silenceCue
          ? 0.82
          : (kind == BlockKind.action ? 0.48 : 0.22),
    );
  }

  (String, String) _splitSlug(String slug) {
    final dash = slug.contains('—')
        ? '—'
        : slug.contains(' - ')
            ? ' - '
            : slug.contains(' – ')
                ? ' – '
                : null;
    if (dash == null) return (slug, 'Day');
    final parts = slug.split(dash);
    return (parts.first.trim(), parts.last.trim());
  }

  String _titleFromSlug(String slug) {
    final cleaned = slug
        .replaceFirst(RegExp(r'^(INT\.|EXT\.|INT/EXT\.|I/E\.)\s*'), '')
        .split(RegExp(r'[—–-]'))
        .first
        .trim();
    if (cleaned.isEmpty) return 'Untitled scene';
    return cleaned
        .split(' ')
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }
}
