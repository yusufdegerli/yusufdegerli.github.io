#pragma once

#include <cstddef>
#include <filesystem>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

/**
 * .cub multi-floor format:
 *
 *   # name My Level
 *   # face east
 *   # floor 0
 *   11111
 *   1P0S1
 *   11111
 *   # floor 1
 *   11111
 *   1S0E1
 *   11111
 *
 * Characters:
 *   1 wall | 0 empty | C coin | P player | E exit
 *   W pistol | R shotgun | G portal gun | A ammo | M enemy | S stairs
 *
 * Stairs: same (x,y) on two floors links them. Walking on S swaps floor.
 */
enum class Tile : unsigned char {
    Empty      = 0,
    Wall       = 1,
    Coin       = 2,
    Exit       = 3,
    Weapon     = 4, // pistol (W)
    Ammo       = 5,
    Stairs     = 6,
    Shotgun    = 7, // R
    PortalGun  = 8, // G
};

enum class Facing : unsigned char {
    East  = 0,
    North = 1,
    West  = 2,
    South = 3,
};

struct SpawnPoint {
    int    gridX  = 0;
    int    gridY  = 0;
    int    floor  = 0;
    Facing facing = Facing::East;
};

struct GridPoint {
    int gridX = 0;
    int gridY = 0;
    int floor = 0;
};

class Map {
public:
    Map() = default;

    static Map LoadFromFile(const std::filesystem::path& path);
    static std::optional<Map> TryLoad(std::string_view filename);

    [[nodiscard]] int Width() const noexcept { return m_width; }
    [[nodiscard]] int Height() const noexcept { return m_height; }
    [[nodiscard]] int FloorCount() const noexcept { return m_floorCount; }
    [[nodiscard]] bool Empty() const noexcept { return m_cells.empty(); }

    [[nodiscard]] const std::string& Name() const noexcept { return m_name; }
    [[nodiscard]] const SpawnPoint& Spawn() const noexcept { return m_spawn; }
    [[nodiscard]] const std::vector<GridPoint>& EnemySpawns() const noexcept
    {
        return m_enemySpawns;
    }
    [[nodiscard]] const std::filesystem::path& SourcePath() const noexcept
    {
        return m_sourcePath;
    }

    [[nodiscard]] bool InBounds(int x, int y) const noexcept;
    [[nodiscard]] bool ValidFloor(int floor) const noexcept;

    [[nodiscard]] Tile At(int floor, int x, int y) const noexcept;
    [[nodiscard]] Tile* AtMut(int floor, int x, int y) noexcept;

    // Convenience: use active floor context is caller's responsibility
    [[nodiscard]] bool IsSolid(int floor, int x, int y) const noexcept;
    [[nodiscard]] bool IsWalkable(int floor, int x, int y) const noexcept;

    [[nodiscard]] bool Collides(int floor, double worldX, double worldY, double radius) const noexcept;

    [[nodiscard]] std::size_t CoinCount() const noexcept;
    [[nodiscard]] std::size_t CoinCountOnFloor(int floor) const noexcept;

    bool TryCollectCoinAt(int floor, double worldX, double worldY);
    bool TryPickupPistolAt(int floor, double worldX, double worldY);
    bool TryPickupShotgunAt(int floor, double worldX, double worldY);
    bool TryPickupPortalGunAt(int floor, double worldX, double worldY);
    bool TryCollectAmmoAt(int floor, double worldX, double worldY);

    [[nodiscard]] bool IsOnExit(int floor, double worldX, double worldY) const noexcept;
    [[nodiscard]] bool IsOnStairs(int floor, double worldX, double worldY) const noexcept;

    /**
     * @brief If (x,y) on floor has stairs, return another floor that has stairs at same cell.
     */
    [[nodiscard]] std::optional<int> StairsDestinationFloor(int floor, int x, int y) const noexcept;

private:
    static Tile CharToTile(char c);
    static std::optional<Facing> ParseFacing(std::string_view token);
    void Validate() const;
    [[nodiscard]] std::size_t Index(int floor, int x, int y) const noexcept;

    int m_width      = 0;
    int m_height     = 0;
    int m_floorCount = 0;
    std::vector<Tile>      m_cells; // floor-major: [f][y*w+x]
    SpawnPoint             m_spawn{};
    std::vector<GridPoint> m_enemySpawns;
    std::string            m_name;
    std::filesystem::path  m_sourcePath;
};
