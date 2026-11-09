#include "Portal.hpp"

#include <cmath>

void PortalSystem::Clear()
{
    m_blue     = {};
    m_orange   = {};
    m_cooldown = 0.0f;
}

std::optional<PortalSystem::WallHit> PortalSystem::CastWall(const Map& map,
                                                            const Player& player,
                                                            double maxDistance)
{
    const int floor = player.Floor();
    if (!map.ValidFloor(floor)) {
        return std::nullopt;
    }

    const double posX = player.X();
    const double posY = player.Y();
    const double dirX = player.DirX();
    const double dirY = player.DirY();

    int mapX = static_cast<int>(std::floor(posX));
    int mapY = static_cast<int>(std::floor(posY));

    const double deltaDistX = (dirX == 0.0) ? 1e30 : std::abs(1.0 / dirX);
    const double deltaDistY = (dirY == 0.0) ? 1e30 : std::abs(1.0 / dirY);

    int stepX = 0;
    int stepY = 0;
    double sideDistX = 0.0;
    double sideDistY = 0.0;
    int side = 0;

    if (dirX < 0.0) {
        stepX     = -1;
        sideDistX = (posX - static_cast<double>(mapX)) * deltaDistX;
    } else {
        stepX     = 1;
        sideDistX = (static_cast<double>(mapX) + 1.0 - posX) * deltaDistX;
    }
    if (dirY < 0.0) {
        stepY     = -1;
        sideDistY = (posY - static_cast<double>(mapY)) * deltaDistY;
    } else {
        stepY     = 1;
        sideDistY = (static_cast<double>(mapY) + 1.0 - posY) * deltaDistY;
    }

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
        if (!map.IsSolid(floor, mapX, mapY)) {
            continue;
        }

        WallHit hit{};
        hit.mapX  = mapX;
        hit.mapY  = mapY;
        hit.side  = side;
        hit.stepX = stepX;
        hit.stepY = stepY;
        if (side == 0) {
            hit.dist = (static_cast<double>(mapX) - posX
                        + (1.0 - static_cast<double>(stepX)) / 2.0)
                       / dirX;
        } else {
            hit.dist = (static_cast<double>(mapY) - posY
                        + (1.0 - static_cast<double>(stepY)) / 2.0)
                       / dirY;
        }
        if (hit.dist < 0.05 || hit.dist > maxDistance) {
            return std::nullopt;
        }
        return hit;
    }
    return std::nullopt;
}

Portal PortalSystem::MakePortal(const Map& map, const WallHit& hit, int floor)
{
    Portal p{};
    p.active = true;
    p.floor  = floor;
    p.wallX  = hit.mapX;
    p.wallY  = hit.mapY;
    p.side   = hit.side;

    if (hit.side == 0) {
        p.openX   = static_cast<double>(hit.mapX) + (hit.stepX > 0 ? -0.35 : 1.35);
        p.openY   = static_cast<double>(hit.mapY) + 0.5;
        p.outDirX = hit.stepX > 0 ? -1.0 : 1.0;
        p.outDirY = 0.0;
    } else {
        p.openX   = static_cast<double>(hit.mapX) + 0.5;
        p.openY   = static_cast<double>(hit.mapY) + (hit.stepY > 0 ? -0.35 : 1.35);
        p.outDirX = 0.0;
        p.outDirY = hit.stepY > 0 ? -1.0 : 1.0;
    }

    if (map.Collides(floor, p.openX, p.openY, 0.15)) {
        if (hit.side == 0) {
            p.openX = static_cast<double>(hit.mapX - hit.stepX) + 0.5;
            p.openY = static_cast<double>(hit.mapY) + 0.5;
        } else {
            p.openX = static_cast<double>(hit.mapX) + 0.5;
            p.openY = static_cast<double>(hit.mapY - hit.stepY) + 0.5;
        }
    }

    return p;
}

bool PortalSystem::TryPlace(const Map& map,
                            const Player& player,
                            PortalColor color,
                            double maxDistance)
{
    const auto hit = CastWall(map, player, maxDistance);
    if (!hit) {
        return false;
    }

    Portal placed = MakePortal(map, *hit, player.Floor());

    // Don't stack both portals on the exact same wall cell/side
    Portal& dest = (color == PortalColor::Blue) ? m_blue : m_orange;
    const Portal& other = (color == PortalColor::Blue) ? m_orange : m_blue;
    if (other.active && other.floor == placed.floor && other.wallX == placed.wallX
        && other.wallY == placed.wallY && other.side == placed.side) {
        // Overwrite the other portal of that color only — clear conflicting other
        if (color == PortalColor::Blue) {
            m_orange.active = false;
        } else {
            m_blue.active = false;
        }
    }

    dest = placed;
    return true;
}

bool PortalSystem::TryTeleport(Player& player, float deltaTime)
{
    if (m_cooldown > 0.0f) {
        m_cooldown -= deltaTime;
        if (m_cooldown < 0.0f) {
            m_cooldown = 0.0f;
        }
        return false;
    }

    if (!BothActive()) {
        return false;
    }

    constexpr double kEnterRadius = 0.45;

    auto nearPortal = [&](const Portal& p) -> bool {
        if (!p.active || p.floor != player.Floor()) {
            return false;
        }
        const double dx = player.X() - p.openX;
        const double dy = player.Y() - p.openY;
        return dx * dx + dy * dy < kEnterRadius * kEnterRadius;
    };

    if (nearPortal(m_blue)) {
        player.SetFloor(m_orange.floor);
        player.SetPosition(m_orange.openX, m_orange.openY);
        player.SetFacing(m_orange.outDirX, m_orange.outDirY);
        m_cooldown = 0.55f;
        return true;
    }
    if (nearPortal(m_orange)) {
        player.SetFloor(m_blue.floor);
        player.SetPosition(m_blue.openX, m_blue.openY);
        player.SetFacing(m_blue.outDirX, m_blue.outDirY);
        m_cooldown = 0.55f;
        return true;
    }

    return false;
}
