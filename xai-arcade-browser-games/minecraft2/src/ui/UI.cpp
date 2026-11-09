#include "minecraft2/ui/UI.hpp"

#include <glad/gl.h>
#define GLFW_INCLUDE_NONE
#include <GLFW/glfw3.h>

#include <cmath>

namespace mc2 {
namespace {

const char* kUIVertex = R"(#version 330 core
layout(location=0) in vec2 aPos;
uniform mat4 projection;
uniform vec2 uOffset;
uniform vec2 uScale;
void main(){
    vec2 p = aPos * uScale + uOffset;
    gl_Position = projection * vec4(p, 0.0, 1.0);
}
)";

const char* kUIFragment = R"(#version 330 core
uniform vec4 uColor;
out vec4 FragColor;
void main(){ FragColor = uColor; }
)";

} // namespace

bool UISystem::init() {
    if (!m_uiShader.loadFromSource(kUIVertex, kUIFragment)) return false;
    ensureGeometry();
    m_ready = true;
    return true;
}

void UISystem::shutdown() {
    if (m_vao) glDeleteVertexArrays(1, &m_vao);
    if (m_vbo) glDeleteBuffers(1, &m_vbo);
    m_vao = m_vbo = 0;
}

void UISystem::ensureGeometry() {
    if (m_vao) return;
    const float quad[] = {0,0, 1,0, 1,1, 0,0, 1,1, 0,1};
    glGenVertexArrays(1, &m_vao);
    glGenBuffers(1, &m_vbo);
    glBindVertexArray(m_vao);
    glBindBuffer(GL_ARRAY_BUFFER, m_vbo);
    glBufferData(GL_ARRAY_BUFFER, sizeof(quad), quad, GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), nullptr);
    glBindVertexArray(0);
}

void UISystem::beginOrtho(int fbW, int fbH) {
    m_uiShader.use();
    const Mat4 proj = Mat4::ortho(0.f, (float)fbW, 0.f, (float)fbH, -1.f, 1.f);
    m_uiShader.setMat4("projection", proj);
    glDisable(GL_DEPTH_TEST);
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glBindVertexArray(m_vao);
}

void UISystem::drawQuad(float x, float y, float w, float h, float r, float g, float b, float a) {
    m_uiShader.setFloat("uOffset", 0.f); // placeholder — use set via uniforms
    // Set offset/scale via locations
    glUniform2f(glGetUniformLocation(m_uiShader.id(), "uOffset"), x, y);
    glUniform2f(glGetUniformLocation(m_uiShader.id(), "uScale"), w, h);
    glUniform4f(glGetUniformLocation(m_uiShader.id(), "uColor"), r, g, b, a);
    glDrawArrays(GL_TRIANGLES, 0, 6);
}

bool UISystem::updateMenu(GLFWwindow* window, int fbW, int fbH) {
    (void)fbW; (void)fbH;
    if (glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_LEFT) == GLFW_PRESS) {
        // Any click / or Enter starts game for simplicity
        return true;
    }
    if (glfwGetKey(window, GLFW_KEY_ENTER) == GLFW_PRESS) return true;
    return false;
}

void UISystem::drawMenu(int fbW, int fbH) {
    if (!m_ready) return;
    beginOrtho(fbW, fbH);
    // Background
    drawQuad(0, 0, (float)fbW, (float)fbH, 0.12f, 0.14f, 0.18f, 1.f);
    // Title bar
    const float cx = fbW * 0.5f;
    const float cy = fbH * 0.55f;
    drawQuad(cx - 200, cy + 40, 400, 50, 0.2f, 0.55f, 0.25f, 1.f);
    // Singleplayer button
    drawQuad(cx - 160, cy - 30, 320, 48, 0.35f, 0.35f, 0.38f, 1.f);
    // Quit hint bar
    drawQuad(cx - 160, cy - 100, 320, 40, 0.25f, 0.25f, 0.28f, 1.f);
    glBindVertexArray(0);
    glDisable(GL_BLEND);
    glEnable(GL_DEPTH_TEST);
}

void UISystem::drawHUD(int fbW, int fbH, const PlayerState& player, const ChatSystem& chat, float /*worldTime*/) {
    if (!m_ready) return;
    beginOrtho(fbW, fbH);

    // Crosshair
    const float cx = fbW * 0.5f, cy = fbH * 0.5f;
    drawQuad(cx - 8, cy - 1, 16, 2, 1, 1, 1, 0.85f);
    drawQuad(cx - 1, cy - 8, 2, 16, 1, 1, 1, 0.85f);

    // Hotbar background — 9 slots (Minecraft-like)
    const float slot = 40.f;
    const float pad = 4.f;
    const float barW = 9 * (slot + pad) + pad;
    const float barX = (fbW - barW) * 0.5f;
    const float barY = 16.f;
    drawQuad(barX, barY, barW, slot + pad * 2, 0.1f, 0.1f, 0.1f, 0.65f);
    for (int i = 0; i < 9; ++i) {
        const float sx = barX + pad + i * (slot + pad);
        const float sy = barY + pad;
        const bool sel = (i == player.selectedSlot);
        drawQuad(sx, sy, slot, slot, sel ? 0.9f : 0.35f, sel ? 0.9f : 0.35f, sel ? 0.9f : 0.35f, sel ? 0.55f : 0.45f);
        // Item color proxy by block id
        const Block& b = player.hotbar[i];
        if (!b.isAir()) {
            float r=0.5f,g=0.5f,bl=0.5f;
            switch (b.id) {
            case BlockId::Grass: r=0.3f;g=0.7f;bl=0.25f; break;
            case BlockId::Dirt: r=0.45f;g=0.3f;bl=0.15f; break;
            case BlockId::Sand: r=0.85f;g=0.8f;bl=0.5f; break;
            case BlockId::Water: r=0.2f;g=0.4f;bl=0.85f; break;
            case BlockId::Log: r=0.45f;g=0.3f;bl=0.15f; break;
            case BlockId::RedstoneDust: r=0.9f;g=0.1f;bl=0.1f; break;
            case BlockId::RedstoneTorch: r=1.f;g=0.3f;bl=0.1f; break;
            default: break;
            }
            drawQuad(sx + 6, sy + 6, slot - 12, slot - 12, r, g, bl, 1.f);
        }
    }

    // Health hearts (10 pairs = 20 hp) left of hotbar
    if (player.mode == GameMode::Survival) {
        const float hx = barX;
        const float hy = barY + slot + pad * 2 + 8;
        for (int i = 0; i < 10; ++i) {
            const float filled = std::min(2.f, std::max(0.f, player.health - i * 2.f));
            drawQuad(hx + i * 18, hy, 16, 14, 0.25f, 0.05f, 0.05f, 0.9f);
            if (filled > 0.f)
                drawQuad(hx + i * 18, hy, 16.f * (filled * 0.5f), 14, 0.85f, 0.15f, 0.15f, 1.f);
        }
        // Food bar right
        const float fx = barX + barW - 10 * 18;
        for (int i = 0; i < 10; ++i) {
            const float filled = std::min(2.f, std::max(0.f, player.food - i * 2.f));
            drawQuad(fx + i * 18, hy, 16, 14, 0.2f, 0.12f, 0.05f, 0.9f);
            if (filled > 0.f)
                drawQuad(fx + i * 18, hy, 16.f * (filled * 0.5f), 14, 0.85f, 0.55f, 0.15f, 1.f);
        }
    }

    // Chat messages
    float chatY = barY + 90.f;
    for (const ChatMessage& m : chat.messages()) {
        const float alpha = std::clamp(1.f - (m.age / 12.f), 0.f, 1.f);
        drawQuad(12, chatY, std::min(600.f, 12.f * (float)m.text.size()), 18, 0, 0, 0, 0.35f * alpha);
        chatY += 20.f;
    }
    if (chat.open) {
        drawQuad(12, 70, (float)fbW - 24, 28, 0, 0, 0, 0.55f);
        // input bar (visual only — text not glyph-rendered; length proxy)
        drawQuad(16, 74, 8.f + 8.f * (float)chat.input.size(), 20, 0.9f, 0.9f, 0.9f, 0.85f);
    }

    glBindVertexArray(0);
    glDisable(GL_BLEND);
    glEnable(GL_DEPTH_TEST);
}

void UISystem::drawInventory(int fbW, int fbH, const PlayerState& player) {
    if (!m_ready || !player.inventoryOpen) return;
    beginOrtho(fbW, fbH);
    drawQuad(0, 0, (float)fbW, (float)fbH, 0, 0, 0, 0.45f);
    const float panelW = 360.f, panelH = 280.f;
    const float px = (fbW - panelW) * 0.5f, py = (fbH - panelH) * 0.5f;
    drawQuad(px, py, panelW, panelH, 0.25f, 0.25f, 0.28f, 0.95f);
    // 3x9 inventory grid
    for (int row = 0; row < 3; ++row) {
        for (int col = 0; col < 9; ++col) {
            const int idx = row * 9 + col;
            const float sx = px + 20 + col * 36;
            const float sy = py + 80 + row * 36;
            drawQuad(sx, sy, 32, 32, 0.4f, 0.4f, 0.42f, 1.f);
            if (!player.inventory[idx].isAir())
                drawQuad(sx + 4, sy + 4, 24, 24, 0.55f, 0.55f, 0.5f, 1.f);
        }
    }
    // hotbar row
    for (int i = 0; i < 9; ++i) {
        const float sx = px + 20 + i * 36;
        const float sy = py + 20;
        drawQuad(sx, sy, 32, 32, 0.35f, 0.35f, 0.38f, 1.f);
        if (!player.hotbar[i].isAir())
            drawQuad(sx + 4, sy + 4, 24, 24, 0.6f, 0.55f, 0.4f, 1.f);
    }
    glBindVertexArray(0);
    glDisable(GL_BLEND);
    glEnable(GL_DEPTH_TEST);
}

Vec3 skyColorForTime(float time) {
    // 0-24000 cycle
    float t = std::fmod(time, 24000.f);
    if (t < 0) t += 24000.f;
    // day 0-12000, night 12000-24000
    const Vec3 day{0.53f, 0.81f, 0.92f};
    const Vec3 dusk{0.95f, 0.45f, 0.25f};
    const Vec3 night{0.02f, 0.02f, 0.08f};
    auto lerp = [](const Vec3& a, const Vec3& b, float u) {
        return a + (b - a) * u;
    };
    if (t < 1000.f) return lerp(night, day, t / 1000.f); // sunrise
    if (t < 11000.f) return day;
    if (t < 13000.f) return lerp(day, dusk, (t - 11000.f) / 2000.f);
    if (t < 14000.f) return lerp(dusk, night, (t - 13000.f) / 1000.f);
    if (t < 22000.f) return night;
    return lerp(night, day, (t - 22000.f) / 2000.f); // dawn
}

float sunAngleForTime(float time) {
    // Full rotation over 24000 ticks
    return (std::fmod(time, 24000.f) / 24000.f) * 6.2831853f;
}

void sunMoonDirection(float time, Vec3& sunDir, Vec3& moonDir) {
    const float a = sunAngleForTime(time);
    sunDir = Vec3{std::cos(a), std::sin(a), 0.2f}.normalized();
    moonDir = Vec3{-sunDir.x, -sunDir.y, -sunDir.z};
}

} // namespace mc2
