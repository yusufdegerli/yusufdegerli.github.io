#include "Game.hpp"

#include <raylib.h>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <string>
#include <tuple>
#include <utility>

Game::Game()
    : Game(Config{})
{
}

Game::Game(Config config)
    : m_config(std::move(config))
{
}

Game::~Game()
{
    Shutdown();
}

bool Game::Init()
{
    if (m_initialized) {
        return true;
    }

    unsigned int flags = 0;
    if (m_config.vsync) {
        flags |= FLAG_VSYNC_HINT;
    }
    if (m_config.fullscreen) {
        flags |= FLAG_FULLSCREEN_MODE;
    }
    flags |= FLAG_WINDOW_RESIZABLE;
    SetConfigFlags(flags);

    InitWindow(m_config.screenWidth, m_config.screenHeight, m_config.title.c_str());
    if (!IsWindowReady()) {
        std::fprintf(stderr, "[Game] Failed to create window.\n");
        return false;
    }

    InitAudioDevice();
    SetTargetFPS(m_config.targetFps);
    SetExitKey(KEY_NULL);

    if (!m_textures.Load()) {
        std::fprintf(stderr, "[Game] Failed to load textures.\n");
        CloseAudioDevice();
        CloseWindow();
        return false;
    }
    m_raycaster.SetTextures(&m_textures);

    if (!LoadMap(m_config.startMap)) {
        m_textures.Unload();
        CloseAudioDevice();
        CloseWindow();
        return false;
    }

    CaptureMouse(true);
    m_initialized = true;
    m_running     = true;
    m_timeSeconds = 0.0f;

    std::printf("[Game] Ready %dx%d — map floors=%d\n",
                m_config.screenWidth, m_config.screenHeight, m_map.FloorCount());
    std::fflush(stdout);
    return true;
}

void Game::Run()
{
    if (!m_initialized && !Init()) {
        return;
    }
    while (m_running && !WindowShouldClose()) {
        const float dt = GetFrameTime();
        ProcessInput();
        Update(dt);
        Draw();
    }
    Shutdown();
}

void Game::Shutdown()
{
    if (!m_initialized) {
        return;
    }
    CaptureMouse(false);
    m_raycaster.SetTextures(nullptr);
    m_textures.Unload();
    if (IsAudioDeviceReady()) {
        CloseAudioDevice();
    }
    if (IsWindowReady()) {
        CloseWindow();
    }
    m_running = m_initialized = false;
    std::printf("[Game] Shutdown complete.\n");
}

bool Game::LoadMap(const std::string& filename)
{
    namespace fs = std::filesystem;
    const fs::path appDir    = GetApplicationDirectory();
    const fs::path besideExe = appDir / "maps" / fs::path(filename).filename();

    try {
        if (fs::exists(besideExe)) {
            m_map = Map::LoadFromFile(besideExe);
        } else if (auto primary = Map::TryLoad(filename)) {
            m_map = std::move(*primary);
        } else if (auto nested = Map::TryLoad(std::string("maps/") + filename)) {
            m_map = std::move(*nested);
        } else {
            m_map = Map::LoadFromFile(filename);
        }
    } catch (const std::exception& ex) {
        std::fprintf(stderr, "[Game] Map load failed: %s\n", ex.what());
        return false;
    }

    m_player.SpawnFromMap(m_map);
    m_player.ResetScore();
    m_enemies.SpawnFromMap(m_map);
    m_portals.Clear();
    m_levelComplete = m_exitBlocked = false;
    m_timeSeconds = m_stairsCooldown = 0.0f;
    m_shotFeedback.clear();
    m_shotFeedbackTimer = 0.0f;

    std::printf("[Game] Loaded \"%s\" %dx%d x%d floors, enemies=%zu coins=%zu\n",
                m_map.Name().c_str(), m_map.Width(), m_map.Height(),
                m_map.FloorCount(), m_enemies.All().size(), m_map.CoinCount());
    return true;
}

void Game::CaptureMouse(bool capture)
{
    m_mouseLook = capture;
    if (capture) {
        DisableCursor();
    } else {
        EnableCursor();
    }
}

void Game::HandleCombatFire()
{
    if (!m_player.TryFireCombat()) {
        return;
    }

    // Shotgun: 5 spread rays; pistol: 1
    const int rays =
        (m_player.CurrentWeapon() == WeaponSlot::Shotgun) ? 5 : 1;
    bool anyHit = false;

    for (int i = 0; i < rays; ++i) {
        // Temporarily rotate for spread (shotgun only)
        double backupDirX = m_player.DirX();
        double backupDirY = m_player.DirY();
        if (rays > 1) {
            const double spread = (i - rays / 2) * 0.06;
            const double c = std::cos(spread);
            const double s = std::sin(spread);
            const double ndx = backupDirX * c - backupDirY * s;
            const double ndy = backupDirX * s + backupDirY * c;
            m_player.SetFacing(ndx, ndy);
        }

        const ShotHit hit = m_enemies.CastShot(m_map, m_player);
        if (hit.kind == ShotHit::Kind::Enemy) {
            if (m_enemies.ApplyShot(hit)) {
                m_player.AddScore(m_config.enemyKillScore);
                anyHit = true;
            }
        }

        if (rays > 1) {
            m_player.SetFacing(backupDirX, backupDirY);
        }
    }

    if (anyHit) {
        m_shotFeedback      = "HIT!";
        m_shotFeedbackTimer = 0.45f;
    } else {
        m_shotFeedback      = "…";
        m_shotFeedbackTimer = 0.12f;
    }
}

void Game::ProcessInput()
{
    if (IsKeyPressed(KEY_ESCAPE)) {
        RequestQuit();
        return;
    }
    if (IsKeyPressed(KEY_TAB)) {
        CaptureMouse(!m_mouseLook);
    }
    if (IsKeyPressed(KEY_M)) {
        m_showMinimap = !m_showMinimap;
    }

    // Weapon select 1 / 2 / 3
    if (IsKeyPressed(KEY_ONE)) {
        if (m_player.SelectWeapon(WeaponSlot::Pistol)) {
            m_shotFeedback = "Pistol";
            m_shotFeedbackTimer = 0.5f;
        }
    }
    if (IsKeyPressed(KEY_TWO)) {
        if (m_player.SelectWeapon(WeaponSlot::Shotgun)) {
            m_shotFeedback = "Shotgun";
            m_shotFeedbackTimer = 0.5f;
        }
    }
    if (IsKeyPressed(KEY_THREE)) {
        if (m_player.SelectWeapon(WeaponSlot::PortalGun)) {
            m_shotFeedback = "Portal Gun";
            m_shotFeedbackTimer = 0.5f;
        }
    }

    const bool portalMode = m_player.CurrentWeapon() == WeaponSlot::PortalGun
                            && m_player.Owns(WeaponSlot::PortalGun);

    if (portalMode) {
        if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
            if (m_portals.TryPlace(m_map, m_player, PortalColor::Blue)) {
                m_shotFeedback = "Blue portal";
                m_shotFeedbackTimer = 0.4f;
            }
        }
        if (IsMouseButtonPressed(MOUSE_BUTTON_RIGHT)) {
            if (m_portals.TryPlace(m_map, m_player, PortalColor::Orange)) {
                m_shotFeedback = "Orange portal";
                m_shotFeedbackTimer = 0.4f;
            }
        }
    } else {
        // Combat: Space or LMB
        if (IsKeyPressed(KEY_SPACE) || IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
            HandleCombatFire();
        }
    }
}

void Game::TryStairs()
{
    if (m_stairsCooldown > 0.0f) {
        return;
    }
    if (!m_map.IsOnStairs(m_player.Floor(), m_player.X(), m_player.Y())) {
        return;
    }
    const int gx = static_cast<int>(std::floor(m_player.X()));
    const int gy = static_cast<int>(std::floor(m_player.Y()));
    if (auto dest = m_map.StairsDestinationFloor(m_player.Floor(), gx, gy)) {
        m_player.SetFloor(*dest);
        // Center on stair cell
        m_player.SetPosition(gx + 0.5, gy + 0.5);
        m_stairsCooldown = 0.6f;
        m_shotFeedback =
            "Floor " + std::to_string(*dest);
        m_shotFeedbackTimer = 0.7f;
    }
}

void Game::Update(float deltaTime)
{
    m_timeSeconds += deltaTime;
    if (m_shotFeedbackTimer > 0.0f) {
        m_shotFeedbackTimer -= deltaTime;
    }
    if (m_stairsCooldown > 0.0f) {
        m_stairsCooldown -= deltaTime;
    }

    m_player.Update(m_map, deltaTime, m_mouseLook, &m_enemies);
    m_enemies.Update(m_map, m_player, deltaTime);
    m_portals.TryTeleport(m_player, deltaTime);
    TryStairs();

    const int f = m_player.Floor();
    if (m_map.TryCollectCoinAt(f, m_player.X(), m_player.Y())) {
        m_player.AddScore(m_config.coinPoints);
    }
    if (m_map.TryPickupPistolAt(f, m_player.X(), m_player.Y())) {
        m_player.GivePistol(m_config.pistolAmmo);
        m_player.AddScore(50);
        m_shotFeedback = "Pistol acquired";
        m_shotFeedbackTimer = 0.8f;
    }
    if (m_map.TryPickupShotgunAt(f, m_player.X(), m_player.Y())) {
        m_player.GiveShotgun(m_config.shotgunAmmo);
        m_player.AddScore(75);
        m_shotFeedback = "Shotgun acquired";
        m_shotFeedbackTimer = 0.8f;
    }
    if (m_map.TryPickupPortalGunAt(f, m_player.X(), m_player.Y())) {
        m_player.GivePortalGun();
        m_player.AddScore(100);
        m_shotFeedback = "Portal Gun!";
        m_shotFeedbackTimer = 0.9f;
    }
    if (m_map.TryCollectAmmoAt(f, m_player.X(), m_player.Y())) {
        m_player.AddAmmo(m_config.ammoBoxAmount);
        m_player.AddScore(25);
    }

    const bool onExit = m_map.IsOnExit(f, m_player.X(), m_player.Y());
    m_levelComplete = onExit && m_map.CoinCount() == 0;
    m_exitBlocked   = onExit && m_map.CoinCount() > 0;
}

void Game::Draw()
{
    const int w = GetScreenWidth();
    const int h = GetScreenHeight();
    BeginDrawing();
    m_raycaster.Render(m_map, m_player, m_enemies, m_portals, w, h, m_timeSeconds);
    DrawCrosshair();
    if (m_showMinimap) {
        DrawMinimap(200);
    }
    DrawHud();
    EndDrawing();
}

void Game::DrawCrosshair() const
{
    const int cx = GetScreenWidth() / 2;
    const int cy = GetScreenHeight() / 2;
    Color c = Color{220, 220, 230, 200};
    if (m_player.CurrentWeapon() == WeaponSlot::PortalGun) {
        c = Color{100, 180, 255, 220};
    }
    DrawLine(cx - 8, cy, cx - 3, cy, c);
    DrawLine(cx + 3, cy, cx + 8, cy, c);
    DrawLine(cx, cy - 8, cx, cy - 3, c);
    DrawLine(cx, cy + 3, cx, cy + 8, c);
}

void Game::DrawHud() const
{
    DrawFPS(GetScreenWidth() - 100, 16);
    DrawText("DOOM 64 CLONE", 16, 16, 22, Color{180, 40, 40, 255});

    DrawText(("Score: " + std::to_string(m_player.Score())).c_str(), 16, 44, 22,
             Color{240, 220, 100, 255});
    DrawText(("Coins left: " + std::to_string(m_map.CoinCount())).c_str(), 16, 72, 18,
             Color{200, 180, 80, 255});
    DrawText(("Floor: " + std::to_string(m_player.Floor()) + " / "
              + std::to_string(std::max(0, m_map.FloorCount() - 1)))
                 .c_str(),
             16, 96, 18, Color{160, 180, 220, 255});

    // Weapon bar
    auto wpnLabel = [&](WeaponSlot s, const char* name, int key) {
        const bool own = m_player.Owns(s);
        const bool cur = m_player.CurrentWeapon() == s;
        Color col = own ? (cur ? Color{255, 220, 100, 255} : Color{180, 180, 190, 255})
                        : Color{80, 80, 90, 255};
        std::string line = std::to_string(key) + ":" + name;
        if (own && s != WeaponSlot::PortalGun) {
            line += " [" + std::to_string(m_player.AmmoFor(s)) + "]";
        } else if (own && s == WeaponSlot::PortalGun) {
            line += " [inf]";
        }
        return std::make_pair(line, col);
    };

    int y = 120;
    for (auto [slot, name, key] :
         {std::tuple{WeaponSlot::Pistol, "Pistol", 1},
          std::tuple{WeaponSlot::Shotgun, "Shotgun", 2},
          std::tuple{WeaponSlot::PortalGun, "Portal", 3}}) {
        auto [line, col] = wpnLabel(slot, name, key);
        DrawText(line.c_str(), 16, y, 18, col);
        y += 22;
    }

    DrawText(("Enemies: " + std::to_string(m_enemies.AliveCountOnFloor(m_player.Floor()))
              + " (floor) / " + std::to_string(m_enemies.AliveCount()) + " total")
                 .c_str(),
             16, y + 4, 16, Color{200, 90, 90, 255});

    if (m_portals.BothActive()) {
        DrawText("Portals linked", 16, y + 28, 16, Color{100, 200, 255, 255});
    } else if (m_portals.Blue().active || m_portals.Orange().active) {
        DrawText("Portal incomplete (need both)", 16, y + 28, 16,
                 Color{255, 160, 80, 255});
    }

    if (m_shotFeedbackTimer > 0.0f && !m_shotFeedback.empty()) {
        const int tw = MeasureText(m_shotFeedback.c_str(), 22);
        DrawText(m_shotFeedback.c_str(), GetScreenWidth() / 2 - tw / 2,
                 GetScreenHeight() / 2 + 28, 22, Color{255, 230, 120, 255});
    }

    DrawText(
        "1/2/3 weapons | LMB fire/blue portal | RMB orange portal | S=stairs | M map | Esc",
        16, GetScreenHeight() - 28, 15, Color{140, 140, 160, 255});

    if (m_exitBlocked && !m_levelComplete) {
        const char* msg = "COLLECT ALL COINS TO EXIT";
        DrawText(msg, GetScreenWidth() / 2 - MeasureText(msg, 28) / 2,
                 GetScreenHeight() / 2 - 16, 28, Color{220, 160, 60, 255});
    }
    if (m_levelComplete) {
        const char* msg = "EXIT REACHED";
        DrawText(msg, GetScreenWidth() / 2 - MeasureText(msg, 40) / 2,
                 GetScreenHeight() / 2 - 20, 40, Color{80, 220, 120, 255});
    }
}

void Game::DrawMinimap(int size) const
{
    if (m_map.Empty() || size <= 0) {
        return;
    }
    const int mapW = m_map.Width();
    const int mapH = m_map.Height();
    const int floor = m_player.Floor();
    const float cell =
        static_cast<float>(size) / static_cast<float>(std::max(mapW, mapH));
    const int ox = GetScreenWidth() - size - 16;
    const int oy = 16;
    const int wPx = static_cast<int>(cell * mapW);
    const int hPx = static_cast<int>(cell * mapH);

    DrawRectangle(ox - 4, oy - 4, wPx + 8, hPx + 8, Color{0, 0, 0, 160});
    DrawText(("F" + std::to_string(floor)).c_str(), ox, oy - 14, 12,
             Color{200, 200, 220, 255});

    for (int y = 0; y < mapH; ++y) {
        for (int x = 0; x < mapW; ++x) {
            Color c = Color{30, 30, 40, 220};
            switch (m_map.At(floor, x, y)) {
            case Tile::Wall: c = Color{120, 40, 40, 220}; break;
            case Tile::Coin: c = Color{220, 190, 60, 220}; break;
            case Tile::Exit: c = Color{40, 180, 90, 220}; break;
            case Tile::Weapon: c = Color{180, 60, 50, 220}; break;
            case Tile::Shotgun: c = Color{160, 100, 50, 220}; break;
            case Tile::PortalGun: c = Color{50, 140, 200, 220}; break;
            case Tile::Ammo: c = Color{50, 140, 70, 220}; break;
            case Tile::Stairs: c = Color{180, 180, 220, 220}; break;
            default: break;
            }
            DrawRectangle(ox + static_cast<int>(x * cell),
                          oy + static_cast<int>(y * cell),
                          std::max(1, static_cast<int>(cell)),
                          std::max(1, static_cast<int>(cell)), c);
        }
    }

    // Portals on this floor
    auto drawPortal = [&](const Portal& p, Color col) {
        if (!p.active || p.floor != floor) {
            return;
        }
        const int px = ox + static_cast<int>(p.openX * cell);
        const int py = oy + static_cast<int>(p.openY * cell);
        DrawCircle(px, py, std::max(3.0f, cell * 0.4f), col);
    };
    drawPortal(m_portals.Blue(), Color{40, 120, 255, 255});
    drawPortal(m_portals.Orange(), Color{255, 140, 30, 255});

    for (const Enemy& e : m_enemies.All()) {
        if (e.Floor() != floor) {
            continue;
        }
        DrawCircle(ox + static_cast<int>(e.X() * cell),
                   oy + static_cast<int>(e.Y() * cell),
                   std::max(2.0f, cell * 0.3f),
                   e.IsAlive() ? Color{220, 50, 50, 255} : Color{90, 70, 70, 200});
    }

    const int px = ox + static_cast<int>(m_player.X() * cell);
    const int py = oy + static_cast<int>(m_player.Y() * cell);
    DrawCircle(px, py, std::max(2.0f, cell * 0.35f), Color{80, 180, 255, 255});
    DrawLine(px, py,
             px + static_cast<int>(m_player.DirX() * cell * 1.2),
             py + static_cast<int>(m_player.DirY() * cell * 1.2),
             Color{200, 220, 255, 255});
}
