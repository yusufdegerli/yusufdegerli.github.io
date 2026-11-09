#pragma once

#include "Map.hpp"
#include "Player.hpp"

#include <optional>

enum class PortalColor : unsigned char {
    Blue   = 0,
    Orange = 1,
};

/**
 * @brief Wall-mounted portal plate (Portal-style).
 */
struct Portal {
    bool   active  = false;
    int    floor   = 0;
    int    wallX   = 0;
    int    wallY   = 0;
    int    side    = 0; // 0 = hit vertical grid line (X), 1 = horizontal (Y)
    double openX   = 0.0; // stand position in front of portal
    double openY   = 0.0;
    double outDirX = 1.0; // facing away from wall after teleport
    double outDirY = 0.0;
};

/**
 * @brief Blue + orange portals, placement rays, and teleport.
 */
class PortalSystem {
public:
    void Clear();

    /**
     * @brief Cast camera-forward ray; if wall hit, place portal of given color.
     * @return true if a portal was placed/replaced.
     */
    bool TryPlace(const Map& map,
                  const Player& player,
                  PortalColor color,
                  double maxDistance = 32.0);

    /**
     * @brief If player walks into an active portal and the other exists, teleport.
     * @return true if teleport occurred.
     */
    bool TryTeleport(Player& player, float deltaTime);

    [[nodiscard]] const Portal& Blue() const noexcept { return m_blue; }
    [[nodiscard]] const Portal& Orange() const noexcept { return m_orange; }
    [[nodiscard]] bool BothActive() const noexcept
    {
        return m_blue.active && m_orange.active;
    }

private:
    struct WallHit {
        int    mapX = 0;
        int    mapY = 0;
        int    side = 0;
        double dist = 0.0;
        int    stepX = 0;
        int    stepY = 0;
    };

    static std::optional<WallHit> CastWall(const Map& map,
                                           const Player& player,
                                           double maxDistance);

    static Portal MakePortal(const Map& map, const WallHit& hit, int floor);

    Portal m_blue{};
    Portal m_orange{};
    float  m_cooldown = 0.0f;
};
