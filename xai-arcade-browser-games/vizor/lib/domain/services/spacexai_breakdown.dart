import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/dialogue_block.dart';
import '../models/scene.dart';

/// Optional SpaceXAI pass. Studio still works if this is missing or fails.
///
/// Pass the key with `--dart-define=XAI_API_KEY=...` or inject [apiKey].
class SpaceXaiBreakdown {
  SpaceXaiBreakdown({http.Client? client, String? apiKey})
      : _client = client ?? http.Client(),
        _apiKey = apiKey ?? const String.fromEnvironment('XAI_API_KEY');

  static const _endpoint = 'https://api.x.ai/v1/chat/completions';
  static const _model = 'grok-4.6';

  final http.Client _client;
  final String _apiKey;

  bool get isConfigured => _apiKey.isNotEmpty;

  Future<Scene> breakdown(String screenplay) async {
    final response = await _client.post(
      Uri.parse(_endpoint),
      headers: {
        'Authorization': 'Bearer $_apiKey',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'model': _model,
        'stream': false,
        'messages': [
          {
            'role': 'system',
            'content':
                'You break screenplays into a shooting script. Reply with JSON only, no markdown. Shape: '
                '{"title":str,"slugline":str,"location":str,"tod":str,"blocks":['
                '{"kind":"slug|action|dialogue","character":str|null,"parenthetical":str|null,'
                '"text":str,"duration_ms":int,"tension":0-1,"intimacy":0-1,"silence":0-1}]}',
          },
          {'role': 'user', 'content': screenplay},
        ],
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('SpaceXAI ${response.statusCode}: ${response.body}');
    }
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final content = decoded['choices']?[0]?['message']?['content'] as String?;
    if (content == null || content.trim().isEmpty) {
      throw StateError('SpaceXAI returned an empty breakdown');
    }
    return sceneFromJson(content);
  }

  @visibleForTesting
  static Scene sceneFromJson(String raw) {
    var text = raw.trim();
    if (text.startsWith('```')) {
      text = text.replaceFirst(RegExp(r'^```(?:json)?'), '').replaceFirst(RegExp(r'```$'), '').trim();
    }
    final map = jsonDecode(text) as Map<String, dynamic>;
    final blocks = <DialogueBlock>[];
    final rawBlocks = map['blocks'] as List<dynamic>? ?? const [];
    for (var i = 0; i < rawBlocks.length; i++) {
      final b = rawBlocks[i] as Map<String, dynamic>;
      final kindName = (b['kind'] as String? ?? 'action').toLowerCase();
      final kind = BlockKind.values.firstWhere(
        (k) => k.name == kindName,
        orElse: () => BlockKind.action,
      );
      final ms = (b['duration_ms'] as num?)?.toInt() ?? 4000;
      blocks.add(
        DialogueBlock(
          id: 'ai-$i',
          kind: kind,
          text: b['text'] as String? ?? '',
          character: b['character'] as String?,
          parenthetical: b['parenthetical'] as String?,
          duration: Duration(milliseconds: ms.clamp(1000, 20000)),
          tension: (b['tension'] as num?)?.toDouble() ?? 0.4,
          intimacy: (b['intimacy'] as num?)?.toDouble() ?? 0.4,
          silence: (b['silence'] as num?)?.toDouble() ?? 0.3,
        ),
      );
    }
    if (blocks.isEmpty) {
      throw StateError('SpaceXAI JSON had no blocks');
    }
    return Scene(
      id: 'ai-${DateTime.now().millisecondsSinceEpoch}',
      title: map['title'] as String? ?? 'Untitled',
      slugline: map['slugline'] as String? ?? 'INT. SCENE — DAY',
      location: map['location'] as String? ?? 'Interior',
      tod: map['tod'] as String? ?? 'Day',
      blocks: blocks,
    );
  }
}
