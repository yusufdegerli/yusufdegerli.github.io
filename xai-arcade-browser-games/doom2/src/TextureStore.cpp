#include "TextureStore.hpp"

#include <cstdio>
#include <cmath>

namespace {

void FreePixelTexture(PixelTexture& t)
{
    if (t.gpu.id > 0) {
        UnloadTexture(t.gpu);
        t.gpu = {};
    }
    if (t.image.data != nullptr) {
        UnloadImage(t.image);
        t.image = {};
    }
    t.pixels.clear();
    t.width = t.height = 0;
    t.ready = false;
}

} // namespace

Color PixelTexture::SamplePixel(int x, int y) const noexcept
{
    if (!ready || pixels.empty() || width <= 0 || height <= 0) {
        return Color{255, 0, 255, 255};
    }
    x %= width;
    y %= height;
    if (x < 0) x += width;
    if (y < 0) y += height;
    return pixels[static_cast<std::size_t>(y * width + x)];
}

Color PixelTexture::Sample(double u, double v) const noexcept
{
    u -= std::floor(u);
    v -= std::floor(v);
    const int x = static_cast<int>(u * static_cast<double>(width)) % width;
    const int y = static_cast<int>(v * static_cast<double>(height)) % height;
    return SamplePixel(x, y);
}

TextureStore::~TextureStore()
{
    Unload();
}

std::filesystem::path TextureStore::ResolveRoot(const std::filesystem::path& preferred)
{
    namespace fs = std::filesystem;
    std::vector<fs::path> candidates;
    if (!preferred.empty()) {
        candidates.push_back(preferred);
    }
    const fs::path appDir = GetApplicationDirectory();
    candidates.push_back(appDir / "assets");
    candidates.push_back(fs::path("assets"));
    candidates.push_back(fs::path("..") / "assets");
    candidates.push_back(fs::path("../..") / "assets");

    for (const auto& c : candidates) {
        std::error_code ec;
        if (fs::exists(c / "textures" / "wall.png", ec) && !ec) {
            return fs::weakly_canonical(c, ec);
        }
    }
    return preferred.empty() ? fs::path("assets") : preferred;
}

bool TextureStore::LoadOne(PixelTexture& out, const std::filesystem::path& path, bool required)
{
    FreePixelTexture(out);
    if (!std::filesystem::exists(path)) {
        std::fprintf(stderr, "[TextureStore] Missing %s%s\n",
                     path.string().c_str(), required ? " (required)" : "");
        return !required;
    }
    Image img = LoadImage(path.string().c_str());
    if (img.data == nullptr) {
        return !required;
    }
    ImageFormat(&img, PIXELFORMAT_UNCOMPRESSED_R8G8B8A8);
    Color* colors = LoadImageColors(img);
    if (!colors) {
        UnloadImage(img);
        return !required;
    }
    out.pixels.assign(colors, colors + img.width * img.height);
    UnloadImageColors(colors);
    out.image  = img;
    out.width  = img.width;
    out.height = img.height;
    out.gpu    = LoadTextureFromImage(img);
    SetTextureFilter(out.gpu, TEXTURE_FILTER_POINT);
    out.ready  = out.gpu.id > 0;
    std::printf("[TextureStore] Loaded %s (%dx%d)\n", path.string().c_str(), out.width, out.height);
    return out.ready || !required;
}

bool TextureStore::Load(const std::filesystem::path& preferredRoot)
{
    Unload();
    m_root = ResolveRoot(preferredRoot);
    std::printf("[TextureStore] Asset root: %s\n", m_root.string().c_str());

    bool ok = true;
    auto L = [&](PixelTexture& t, const char* sub) {
        ok = LoadOne(t, m_root / sub, true) && ok;
    };
    L(m_wall, "textures/wall.png");
    L(m_floor, "textures/floor.png");
    L(m_ceiling, "textures/ceiling.png");
    L(m_coin, "sprites/coin.png");
    L(m_exit, "sprites/exit.png");
    L(m_hand, "sprites/hand.png");
    L(m_weapon, "sprites/weapon.png");
    L(m_weaponWorld, "sprites/weapon_world.png");
    L(m_weapon2, "sprites/weapon2.png");
    L(m_weapon2World, "sprites/weapon2_world.png");
    L(m_portalGun, "sprites/portal_gun.png");
    L(m_portalGunWorld, "sprites/portal_gun_world.png");
    L(m_portalBlue, "sprites/portal_blue.png");
    L(m_portalOrange, "sprites/portal_orange.png");
    L(m_ammo, "sprites/ammo.png");
    L(m_enemy, "sprites/enemy.png");
    L(m_enemyDead, "sprites/enemy_dead.png");

    m_ready = ok;
    return m_ready;
}

void TextureStore::Unload()
{
    FreePixelTexture(m_wall);
    FreePixelTexture(m_floor);
    FreePixelTexture(m_ceiling);
    FreePixelTexture(m_coin);
    FreePixelTexture(m_exit);
    FreePixelTexture(m_hand);
    FreePixelTexture(m_weapon);
    FreePixelTexture(m_weaponWorld);
    FreePixelTexture(m_weapon2);
    FreePixelTexture(m_weapon2World);
    FreePixelTexture(m_portalGun);
    FreePixelTexture(m_portalGunWorld);
    FreePixelTexture(m_portalBlue);
    FreePixelTexture(m_portalOrange);
    FreePixelTexture(m_ammo);
    FreePixelTexture(m_enemy);
    FreePixelTexture(m_enemyDead);
    m_ready = false;
}
