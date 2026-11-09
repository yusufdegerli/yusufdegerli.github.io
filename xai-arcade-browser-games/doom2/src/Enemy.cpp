#include "Enemy.hpp"

#include <algorithm>
#include <cmath>

Enemy::Enemy(double x, double y, int floor)
    : m_x(x)
    , m_y(y)
    , m_floor(floor)
{
}

void Enemy::Kill() noexcept
{
    m_state = EnemyState::Dead;
}

bool Enemy::BlocksAt(double worldX, double worldY, double playerRadius) const noexcept
{
    if (!IsAlive()) {
        return false;
    }
    const double dx = worldX - m_x;
    const double dy = worldY - m_y;
    const double r  = m_settings.radius + playerRadius;
    return dx * dx + dy * dy < r * r;
}

void Enemy::Update(const Map& map, const Player& player, float deltaTime)
{
    if (!IsAlive() || deltaTime <= 0.0f) {
        return;
    }
    // Only chase on the same floor
    if (m_floor != player.Floor()) {
        return;
    }

    const double dx   = player.X() - m_x;
    const double dy   = player.Y() - m_y;
    const double dist = std::hypot(dx, dy);
    if (dist > m_settings.aggroRange || dist < 1e-6) {
        return;
    }

    const double nx   = dx / dist;
    const double ny   = dy / dist;
    const double step = m_settings.moveSpeed * static_cast<double>(deltaTime);
    const double stopDist =
        m_settings.radius + player.GetSettings().radius + 0.05;
    if (dist <= stopDist) {
        return;
    }

    const double move = std::min(step, dist - stopDist);
    TryMove(map, nx * move, ny * move);
}

void Enemy::TryMove(const Map& map, double dx, double dy) noexcept
{
    const double r = m_settings.radius * 0.85;
    if (!map.Collides(m_floor, m_x + dx, m_y, r)) {
        m_x += dx;
    }
    if (!map.Collides(m_floor, m_x, m_y + dy, r)) {
        m_y += dy;
    }
}

void EnemySystem::Clear()
{
    m_enemies.clear();
}

void EnemySystem::SpawnFromMap(const Map& map)
{
    Clear();
    for (const auto& sp : map.EnemySpawns()) {
        m_enemies.emplace_back(
            static_cast<double>(sp.gridX) + 0.5,
            static_cast<double>(sp.gridY) + 0.5,
            sp.floor
        );
    }
}

void EnemySystem::Update(const Map& map, const Player& player, float deltaTime)
{
    for (Enemy& e : m_enemies) {
        e.Update(map, player, deltaTime);
    }
}

ShotHit EnemySystem::CastShot(const Map& map,
                              const Player& player,
                              double maxDistance) const
{
    ShotHit result{};
    result.kind     = ShotHit::Kind::None;
    result.distance = maxDistance;

    const int floor = player.Floor();
    const double posX = player.X();
    const double posY = player.Y();
    const double dirX = player.DirX();
    const double dirY = player.DirY();

    int mapX = static_cast<int>(std::floor(posX));
    int mapY = static_cast<int>(std::floor(posY));

    const double deltaDistX = (dirX == 0.0) ? 1e30 : std::abs(1.0 / dirX);
    const double deltaDistY = (dirY == 0.0) ? 1e30 : std::abs(1.0 / dirY);

    int stepX = 0, stepY = 0, side = 0;
    double sideDistX = 0.0, sideDistY = 0.0;

    if (dirX < 0.0) {
        stepX = -1;
        sideDistX = (posX - static_cast<double>(mapX)) * deltaDistX;
    } else {
        stepX = 1;
        sideDistX = (static_cast<double>(mapX) + 1.0 - posX) * deltaDistX;
    }
    if (dirY < 0.0) {
        stepY = -1;
        sideDistY = (posY - static_cast<double>(mapY)) * deltaDistY;
    } else {
        stepY = 1;
        sideDistY = (static_cast<double>(mapY) + 1.0 - posY) * deltaDistY;
    }

    double wallDist = maxDistance;
    bool hitWall = false;
    for (int i = 0; i < 64; ++i) {
        if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
        } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
        }
        if (map.IsSolid(floor, mapX, mapY)) {
            hitWall = true;
            if (side == 0) {
                wallDist = (static_cast<double>(mapX) - posX
                            + (1.0 - static_cast<double>(stepX)) / 2.0)
                           / dirX;
            } else {
                wallDist = (static_cast<double>(mapY) - posY
                            + (1.0 - static_cast<double>(stepY)) / 2.0)
                           / dirY;
            }
            if (wallDist < 0.0) {
                wallDist = 0.0;
            }
            break;
        }
    }

    if (hitWall && wallDist < result.distance) {
        result.kind     = ShotHit::Kind::Wall;
        result.distance = wallDist;
        result.wallMapX = mapX;
        result.wallMapY = mapY;
        result.wallSide = side;
    }

    for (int i = 0; i < static_cast<int>(m_enemies.size()); ++i) {
        const Enemy& e = m_enemies[static_cast<std::size_t>(i)];
        if (!e.IsAlive() || e.Floor() != floor) {
            continue;
        }

        const double fx = e.X() - posX;
        const double fy = e.Y() - posY;
        const double t  = fx * dirX + fy * dirY;
        if (t <= 0.05 || t >= result.distance) {
            continue;
        }

        const double closestX = posX + dirX * t;
        const double closestY = posY + dirY * t;
        const double distSq =
            (e.X() - closestX) * (e.X() - closestX)
            + (e.Y() - closestY) * (e.Y() - closestY);
        const double hitR = e.Radius() * 1.15;
        if (distSq <= hitR * hitR) {
            result.kind       = ShotHit::Kind::Enemy;
            result.distance   = t;
            result.enemyIndex = i;
            result.wallMapX   = -1;
            result.wallMapY   = -1;
        }
    }

    return result;
}

bool EnemySystem::ApplyShot(const ShotHit& hit)
{
    if (hit.kind != ShotHit::Kind::Enemy || hit.enemyIndex < 0
        || hit.enemyIndex >= static_cast<int>(m_enemies.size())) {
        return false;
    }
    Enemy& e = m_enemies[static_cast<std::size_t>(hit.enemyIndex)];
    if (!e.IsAlive()) {
        return false;
    }
    e.Kill();
    return true;
}

bool EnemySystem::CollidesLiving(int floor,
                                 double worldX,
                                 double worldY,
                                 double radius) const noexcept
{
    for (const Enemy& e : m_enemies) {
        if (e.Floor() != floor) {
            continue;
        }
        if (e.BlocksAt(worldX, worldY, radius)) {
            return true;
        }
    }
    return false;
}

std::size_t EnemySystem::AliveCount() const noexcept
{
    std::size_t n = 0;
    for (const Enemy& e : m_enemies) {
        if (e.IsAlive()) {
            ++n;
        }
    }
    return n;
}

std::size_t EnemySystem::AliveCountOnFloor(int floor) const noexcept
{
    std::size_t n = 0;
    for (const Enemy& e : m_enemies) {
        if (e.IsAlive() && e.Floor() == floor) {
            ++n;
        }
    }
    return n;
}
