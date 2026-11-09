#pragma once

#include "Enemy.hpp"
#include "Map.hpp"
#include "Player.hpp"
#include "Portal.hpp"
#include "TextureStore.hpp"

#include <raylib.h>

#include <vector>

class Raycaster {
public:
    struct Settings {
        Color fog       = Color{8, 8, 16, 255};
        float fogStart  = 2.0f;
        float fogEnd    = 14.0f;
        float coinBobAmp     = 0.12f;
        float coinBobSpeed   = 3.0f;
        float exitPulseSpeed = 2.5f;
        float weaponBobAmp   = 0.10f;
        float weaponBobSpeed = 2.6f;
        float ammoBobAmp     = 0.10f;
        float ammoBobSpeed   = 2.8f;
        float handScale      = 1.15f;
        float weaponScale    = 2.6f;
        float shotgunScale   = 2.4f;
        float portalGunScale = 2.5f;
        float handBobX       = 14.0f;
        float handBobY       = 10.0f;
        float handSway       = 8.0f;
        float fireKickX      = 6.0f;
        float fireKickY      = 28.0f;
        float muzzleFlashSize = 48.0f;
    };

    Raycaster() = default;
    ~Raycaster();

    Raycaster(const Raycaster&)            = delete;
    Raycaster& operator=(const Raycaster&) = delete;

    void SetTextures(const TextureStore* store) noexcept { m_textures = store; }
    void SetSettings(const Settings& s) noexcept { m_settings = s; }

    void Render(const Map& map,
                const Player& player,
                const EnemySystem& enemies,
                const PortalSystem& portals,
                int screenW,
                int screenH,
                float timeSeconds);

private:
    struct Billboard {
        double x = 0.0;
        double y = 0.0;
        double z = 0.0;
        const PixelTexture* tex = nullptr;
        float  scale  = 0.6f;
        bool   isExit = false;
    };

    void EnsureBuffer(int w, int h);
    void RenderWorld(const Map& map,
                     const Player& player,
                     const PortalSystem& portals,
                     float timeSeconds);
    void RenderSprites(const Map& map,
                       const Player& player,
                       const EnemySystem& enemies,
                       float timeSeconds);
    void RenderViewmodel(const Player& player, int screenW, int screenH) const;

    [[nodiscard]] static Color LerpColor(Color a, Color b, float t) noexcept;
    [[nodiscard]] Color ApplyFog(Color c, float dist) const noexcept;
    [[nodiscard]] Color Darken(Color c, float factor) const noexcept;
    void PutPixel(int x, int y, Color c) noexcept;

    [[nodiscard]] static bool IsPortalWall(const Portal& p,
                                           int floor,
                                           int mapX,
                                           int mapY,
                                           int side) noexcept;

    Settings            m_settings{};
    const TextureStore* m_textures = nullptr;

    int                 m_w = 0;
    int                 m_h = 0;
    std::vector<Color>  m_pixels;
    std::vector<double> m_zBuffer;
    Texture2D           m_frameTex{};
    bool                m_frameReady = false;
};
