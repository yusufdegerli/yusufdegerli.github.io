enum BlockKind { slug, action, dialogue, parenthetical }

/// One timed unit of a shooting script.
class DialogueBlock {
  const DialogueBlock({
    required this.id,
    required this.kind,
    required this.text,
    required this.duration,
    required this.tension,
    required this.intimacy,
    required this.silence,
    this.character,
    this.parenthetical,
  });

  final String id;
  final BlockKind kind;
  final String? character;
  final String? parenthetical;
  final String text;
  final Duration duration;

  /// Emotional weights in 0–1, used by the pacing analyzer.
  final double tension;
  final double intimacy;
  final double silence;

  bool get isSpoken =>
      kind == BlockKind.dialogue || kind == BlockKind.parenthetical;

  String get liveLabel {
    if (character != null && character!.isNotEmpty) return character!;
    return switch (kind) {
      BlockKind.slug => 'SLUG',
      BlockKind.action => 'ACTION',
      BlockKind.dialogue => 'LINE',
      BlockKind.parenthetical => 'BEAT',
    };
  }
}
