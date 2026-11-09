#pragma once

#include "minecraft2/entity/Entities.hpp"

#include <deque>
#include <string>
#include <vector>

namespace mc2 {

class World;

struct ChatMessage {
    std::string text;
    float age = 0.0f;
};

class ChatSystem {
public:
    bool open = false;
    std::string input;

    void addMessage(const std::string& text);
    void update(float dt);
    bool handleKey(int key, int action, int mods, PlayerState& player, World& world, float& worldTime);
    void handleChar(unsigned int codepoint);

    const std::deque<ChatMessage>& messages() const { return m_messages; }

private:
    bool executeCommand(const std::string& line, PlayerState& player, World& world, float& worldTime);
    std::deque<ChatMessage> m_messages;
    static constexpr std::size_t kMaxMessages = 12;
    static constexpr float kMessageLife = 12.0f;
};

} // namespace mc2
