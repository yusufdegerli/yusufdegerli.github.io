#include "minecraft2/ui/Chat.hpp"
#include "minecraft2/world/World.hpp"

#include <GLFW/glfw3.h>
#include <algorithm>
#include <cctype>
#include <sstream>

namespace mc2 {

void ChatSystem::addMessage(const std::string& text) {
    m_messages.push_front(ChatMessage{text, 0.f});
    while (m_messages.size() > kMaxMessages) m_messages.pop_back();
}

void ChatSystem::update(float dt) {
    for (ChatMessage& m : m_messages) m.age += dt;
    while (!m_messages.empty() && m_messages.back().age > kMessageLife)
        m_messages.pop_back();
}

void ChatSystem::handleChar(unsigned int codepoint) {
    if (!open) return;
    if (codepoint >= 32 && codepoint < 127 && input.size() < 256)
        input.push_back(static_cast<char>(codepoint));
}

bool ChatSystem::executeCommand(const std::string& line, PlayerState& player, World& world, float& worldTime) {
    if (line.empty() || line[0] != '/') return false;
    std::istringstream iss(line.substr(1));
    std::string cmd;
    iss >> cmd;
    for (char& c : cmd) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));

    if (cmd == "gamemode" || cmd == "gm") {
        int mode = 0;
        iss >> mode;
        if (mode == 1) {
            player.mode = GameMode::Creative;
            player.body.noClip = false; // still collide; fly with double-space feel via creative
            addMessage("Game mode set to Creative");
        } else {
            player.mode = GameMode::Survival;
            player.body.noClip = false;
            addMessage("Game mode set to Survival");
        }
        return true;
    }
    if (cmd == "time") {
        std::string sub, when;
        iss >> sub >> when;
        for (char& c : sub) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
        for (char& c : when) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
        if (sub == "set") {
            if (when == "day") { worldTime = 1000.f; addMessage("Time set to day"); }
            else if (when == "night") { worldTime = 13000.f; addMessage("Time set to night"); }
            else if (when == "noon") { worldTime = 6000.f; addMessage("Time set to noon"); }
            else if (when == "midnight") { worldTime = 18000.f; addMessage("Time set to midnight"); }
            else {
                try {
                    worldTime = std::stof(when);
                    addMessage("Time set to " + when);
                } catch (...) {
                    addMessage("Usage: /time set day|night|<0-24000>");
                }
            }
        }
        return true;
    }
    if (cmd == "tp") {
        float x,y,z;
        if (iss >> x >> y >> z) {
            player.body.position = {x,y,z};
            player.body.velocity = {};
            addMessage("Teleported");
        } else addMessage("Usage: /tp <x> <y> <z>");
        return true;
    }
    if (cmd == "heal") {
        player.health = player.maxHealth;
        player.food = player.maxFood;
        addMessage("Healed");
        return true;
    }
    if (cmd == "seed") {
        addMessage("Seed: " + std::to_string(world.seed()));
        return true;
    }
    if (cmd == "help") {
        addMessage("/gamemode 0|1  /time set day|night  /tp x y z  /heal  /seed");
        return true;
    }
    addMessage("Unknown command: /" + cmd);
    return true;
}

bool ChatSystem::handleKey(int key, int action, int mods, PlayerState& player, World& world, float& worldTime) {
    (void)mods;
    if (action != GLFW_PRESS && action != GLFW_REPEAT) return false;

    if (!open) {
        if (key == GLFW_KEY_T) {
            open = true;
            input.clear();
            return true;
        }
        if (key == GLFW_KEY_SLASH) {
            open = true;
            input = "/";
            return true;
        }
        return false;
    }

    // Chat is open — consume keys
    if (key == GLFW_KEY_ESCAPE) {
        open = false;
        input.clear();
        return true;
    }
    if (key == GLFW_KEY_ENTER || key == GLFW_KEY_KP_ENTER) {
        if (!input.empty()) {
            if (input[0] == '/') {
                executeCommand(input, player, world, worldTime);
            } else {
                addMessage("<Player> " + input);
            }
        }
        open = false;
        input.clear();
        return true;
    }
    if (key == GLFW_KEY_BACKSPACE) {
        if (!input.empty()) input.pop_back();
        return true;
    }
    return true; // swallow other keys while chat open
}

} // namespace mc2
