#pragma once

#include "minecraft2/entity/Entities.hpp"
#include "minecraft2/math/Mat4.hpp"
#include "minecraft2/render/Shader.hpp"
#include "minecraft2/ui/Chat.hpp"

#include <string>
#include <vector>

struct GLFWwindow;

namespace mc2 {

enum class GameScreen {
    MainMenu,
    Playing
};

// Immediate-mode-ish UI drawn with colored orthographic quads.
class UISystem {
public:
    bool init();
    void shutdown();

    GameScreen screen() const { return m_screen; }
    void setScreen(GameScreen s) { m_screen = s; }

    // Menu: returns true if user clicked "Singleplayer"
    bool updateMenu(GLFWwindow* window, int fbW, int fbH);

    void drawMenu(int fbW, int fbH);
    void drawHUD(int fbW, int fbH, const PlayerState& player, const ChatSystem& chat,
                 float worldTime);
    void drawInventory(int fbW, int fbH, const PlayerState& player);

    // Crosshair, hotbar, hearts, hunger — orthographic.
    Shader& uiShader() { return m_uiShader; }

private:
    void drawQuad(float x, float y, float w, float h, float r, float g, float b, float a = 1.f);
    void beginOrtho(int fbW, int fbH);
    void ensureGeometry();

    GameScreen m_screen = GameScreen::MainMenu;
    Shader m_uiShader;
    unsigned int m_vao = 0, m_vbo = 0;
    bool m_ready = false;
};

// World time helpers (0..24000 like Minecraft)
Vec3 skyColorForTime(float time);
float sunAngleForTime(float time); // radians around XZ
void sunMoonDirection(float time, Vec3& sunDir, Vec3& moonDir);

} // namespace mc2
