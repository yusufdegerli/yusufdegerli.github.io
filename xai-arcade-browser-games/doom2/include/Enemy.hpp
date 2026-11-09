#pragma once

#include "Map.hpp"
#include "Player.hpp"

#include <cstddef>
#include <vector>

enum class EnemyState : unsigned char {
    Alive = 0,
    Dead  = 1,
};

class Enemy {
public:
    struct Settings {
        double radius     = 0.28;
        double moveSpeed  = 1.15;
        double aggroRange = 7.0;
        float  spriteScaleAlive = 0.85f;
        float  spriteScaleDead  = 0.70f;
    };

    Enemy() = default;
    Enemy(double x, double y, int floor);

    void SetSettings(const Settings& s) noexcept { m_settings = s; }
    [[nodiscard]] const Settings& GetSettings() const noexcept { return m_settings; }

    void Update(const Map& map, const Player& player, float deltaTime);

    void Kill() noexcept;
    [[nodiscard]] bool IsAlive() const noexcept { return m_state == EnemyState::Alive; }
    [[nodiscard]] bool IsDead() const noexcept { return m_state == EnemyState::Dead; }

    [[nodiscard]] double X() const noexcept { return m_x; }
    [[nodiscard]] double Y() const noexcept { return m_y; }
    [[nodiscard]] int    Floor() const noexcept { return m_floor; }
    [[nodiscard]] double Radius() const noexcept { return m_settings.radius; }

    [[nodiscard]] bool BlocksAt(double worldX, double worldY, double playerRadius) const noexcept;

private:
    void TryMove(const Map& map, double dx, double dy) noexcept;

    Settings   m_settings{};
    double     m_x     = 0.0;
    double     m_y     = 0.0;
    int        m_floor = 0;
    EnemyState m_state = EnemyState::Alive;
};

struct ShotHit {
    enum class Kind { None, Wall, Enemy };

    Kind   kind       = Kind::None;
    double distance   = 0.0;
    int    enemyIndex = -1;
    int    wallMapX   = -1;
    int    wallMapY   = -1;
    int    wallSide   = 0;
};

class EnemySystem {
public:
    void Clear();
    void SpawnFromMap(const Map& map);

    void Update(const Map& map, const Player& player, float deltaTime);

    [[nodiscard]] ShotHit CastShot(const Map& map,
                                   const Player& player,
                                   double maxDistance = 32.0) const;

    bool ApplyShot(const ShotHit& hit);

    [[nodiscard]] bool CollidesLiving(int floor,
                                      double worldX,
                                      double worldY,
                                      double radius) const noexcept;

    [[nodiscard]] const std::vector<Enemy>& All() const noexcept { return m_enemies; }
    [[nodiscard]] std::vector<Enemy>& All() noexcept { return m_enemies; }
    [[nodiscard]] std::size_t AliveCount() const noexcept;
    [[nodiscard]] std::size_t AliveCountOnFloor(int floor) const noexcept;

private:
    std::vector<Enemy> m_enemies;
};
