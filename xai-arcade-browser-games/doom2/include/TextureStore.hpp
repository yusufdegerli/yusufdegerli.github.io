#pragma once

#include <raylib.h>

#include <filesystem>
#include <vector>

struct PixelTexture {
    Image              image{};
    Texture2D          gpu{};
    std::vector<Color> pixels;
    int                width  = 0;
    int                height = 0;
    bool               ready  = false;

    [[nodiscard]] Color Sample(double u, double v) const noexcept;
    [[nodiscard]] Color SamplePixel(int x, int y) const noexcept;
};

class TextureStore {
public:
    TextureStore() = default;
    ~TextureStore();

    TextureStore(const TextureStore&)            = delete;
    TextureStore& operator=(const TextureStore&) = delete;

    bool Load(const std::filesystem::path& preferredRoot = {});
    void Unload();

    [[nodiscard]] bool IsReady() const noexcept { return m_ready; }
    [[nodiscard]] const std::filesystem::path& Root() const noexcept { return m_root; }

    [[nodiscard]] const PixelTexture& Wall() const noexcept { return m_wall; }
    [[nodiscard]] const PixelTexture& Floor() const noexcept { return m_floor; }
    [[nodiscard]] const PixelTexture& Ceiling() const noexcept { return m_ceiling; }
    [[nodiscard]] const PixelTexture& Coin() const noexcept { return m_coin; }
    [[nodiscard]] const PixelTexture& Exit() const noexcept { return m_exit; }
    [[nodiscard]] const PixelTexture& Hand() const noexcept { return m_hand; }
    [[nodiscard]] const PixelTexture& Weapon() const noexcept { return m_weapon; }
    [[nodiscard]] const PixelTexture& WeaponWorld() const noexcept { return m_weaponWorld; }
    [[nodiscard]] const PixelTexture& Weapon2() const noexcept { return m_weapon2; }
    [[nodiscard]] const PixelTexture& Weapon2World() const noexcept { return m_weapon2World; }
    [[nodiscard]] const PixelTexture& PortalGun() const noexcept { return m_portalGun; }
    [[nodiscard]] const PixelTexture& PortalGunWorld() const noexcept { return m_portalGunWorld; }
    [[nodiscard]] const PixelTexture& PortalBlue() const noexcept { return m_portalBlue; }
    [[nodiscard]] const PixelTexture& PortalOrange() const noexcept { return m_portalOrange; }
    [[nodiscard]] const PixelTexture& Ammo() const noexcept { return m_ammo; }
    [[nodiscard]] const PixelTexture& Enemy() const noexcept { return m_enemy; }
    [[nodiscard]] const PixelTexture& EnemyDead() const noexcept { return m_enemyDead; }

private:
    bool LoadOne(PixelTexture& out, const std::filesystem::path& path, bool required);
    static std::filesystem::path ResolveRoot(const std::filesystem::path& preferred);

    std::filesystem::path m_root;
    bool                  m_ready = false;

    PixelTexture m_wall{};
    PixelTexture m_floor{};
    PixelTexture m_ceiling{};
    PixelTexture m_coin{};
    PixelTexture m_exit{};
    PixelTexture m_hand{};
    PixelTexture m_weapon{};
    PixelTexture m_weaponWorld{};
    PixelTexture m_weapon2{};
    PixelTexture m_weapon2World{};
    PixelTexture m_portalGun{};
    PixelTexture m_portalGunWorld{};
    PixelTexture m_portalBlue{};
    PixelTexture m_portalOrange{};
    PixelTexture m_ammo{};
    PixelTexture m_enemy{};
    PixelTexture m_enemyDead{};
};
