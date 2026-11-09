#pragma once

#include "Enemy.hpp"
#include "Map.hpp"
#include "Player.hpp"
#include "Portal.hpp"
#include "Raycaster.hpp"
#include "TextureStore.hpp"

#include <string>

class Game {
public:
    struct Config {
        int         screenWidth    = 1280;
        int         screenHeight   = 720;
        std::string title          = "Doom 64 Clone";
        int         targetFps      = 60;
        bool        fullscreen     = false;
        bool        vsync          = true;
        std::string startMap       = "level01.cub";
        int         coinPoints     = 100;
        int         pistolAmmo     = 12;
        int         shotgunAmmo    = 8;
        int         ammoBoxAmount  = 8;
        int         enemyKillScore = 250;
    };

    Game();
    explicit Game(Config config);
    ~Game();

    Game(const Game&)            = delete;
    Game& operator=(const Game&) = delete;
    Game(Game&&)                 = delete;
    Game& operator=(Game&&)      = delete;

    bool Init();
    void Run();
    void Shutdown();

    [[nodiscard]] bool IsRunning() const noexcept { return m_running; }
    [[nodiscard]] const Config& GetConfig() const noexcept { return m_config; }

private:
    void ProcessInput();
    void Update(float deltaTime);
    void Draw();
    void DrawHud() const;
    void DrawMinimap(int size) const;
    void DrawCrosshair() const;
    void HandleCombatFire();
    void TryStairs();

    bool LoadMap(const std::string& filename);
    void CaptureMouse(bool capture);
    void RequestQuit() noexcept { m_running = false; }

    Config       m_config{};
    TextureStore m_textures{};
    Map          m_map{};
    Player       m_player{};
    EnemySystem  m_enemies{};
    PortalSystem m_portals{};
    Raycaster    m_raycaster{};

    bool  m_initialized   = false;
    bool  m_running       = false;
    bool  m_mouseLook     = true;
    bool  m_showMinimap   = true;
    bool  m_levelComplete = false;
    bool  m_exitBlocked   = false;
    float m_timeSeconds   = 0.0f;
    float m_stairsCooldown = 0.0f;

    float       m_shotFeedbackTimer = 0.0f;
    std::string m_shotFeedback;
};
