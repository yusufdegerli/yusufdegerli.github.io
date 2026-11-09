#include "Map.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <fstream>
#include <stdexcept>

namespace {

constexpr int kMaxMapWidth  = 512;
constexpr int kMaxMapHeight = 512;
constexpr int kMinMapWidth  = 3;
constexpr int kMinMapHeight = 3;
constexpr int kMaxFloors    = 16;

std::string Trim(std::string_view sv)
{
    while (!sv.empty() && std::isspace(static_cast<unsigned char>(sv.front()))) {
        sv.remove_prefix(1);
    }
    while (!sv.empty() && std::isspace(static_cast<unsigned char>(sv.back()))) {
        sv.remove_suffix(1);
    }
    return std::string(sv);
}

std::string ToLower(std::string s)
{
    for (char& c : s) {
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }
    return s;
}

} // namespace

Map Map::LoadFromFile(const std::filesystem::path& path)
{
    std::ifstream in(path);
    if (!in) {
        throw std::runtime_error("Failed to open map: " + path.string());
    }

    in.seekg(0, std::ios::end);
    const auto fileSize = in.tellg();
    if (fileSize < 0) {
        throw std::runtime_error("Failed to size map file: " + path.string());
    }
    constexpr std::streamoff kMaxFileBytes = 4 * 1024 * 1024;
    if (fileSize > kMaxFileBytes) {
        throw std::runtime_error("Map file too large: " + path.string());
    }
    in.seekg(0, std::ios::beg);

    Map map;
    map.m_sourcePath = path;
    map.m_name       = path.stem().string();

    Facing headerFacing    = Facing::East;
    bool   hasHeaderFacing = false;
    bool   foundSpawn      = false;
    SpawnPoint spawn{};

    // Accumulate floors: each is a list of rows
    std::vector<std::vector<std::string>> floors;
    floors.emplace_back(); // start floor 0 by default

    std::string line;
    int         lineNo = 0;
    while (std::getline(in, line)) {
        ++lineNo;
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }

        const std::string trimmed = Trim(line);
        if (trimmed.empty()) {
            continue;
        }

        if (trimmed.front() == '#') {
            const std::string body = Trim(std::string_view(trimmed).substr(1));
            const std::string key  = ToLower(body);

            if (key.rfind("face", 0) == 0) {
                std::string rest = body.substr(4);
                rest             = Trim(rest);
                if (!rest.empty() && (rest.front() == ':' || rest.front() == '=')) {
                    rest = Trim(std::string_view(rest).substr(1));
                }
                if (auto f = ParseFacing(rest)) {
                    headerFacing    = *f;
                    hasHeaderFacing = true;
                } else {
                    throw std::runtime_error(
                        path.string() + ":" + std::to_string(lineNo) + ": bad face"
                    );
                }
            } else if (key.rfind("name", 0) == 0) {
                std::string rest = body.substr(4);
                rest             = Trim(rest);
                if (!rest.empty() && (rest.front() == ':' || rest.front() == '=')) {
                    rest = Trim(std::string_view(rest).substr(1));
                }
                if (!rest.empty()) {
                    map.m_name = rest;
                }
            } else if (key.rfind("floor", 0) == 0) {
                // New floor section. If current floor already has rows, push new.
                if (!floors.back().empty()) {
                    floors.emplace_back();
                }
                if (static_cast<int>(floors.size()) > kMaxFloors) {
                    throw std::runtime_error(path.string() + ": too many floors");
                }
            }
            continue;
        }

        for (char c : trimmed) {
            switch (c) {
            case '0':
            case '1':
            case 'C': case 'c':
            case 'P': case 'p':
            case 'E': case 'e':
            case 'W': case 'w':
            case 'A': case 'a':
            case 'M': case 'm':
            case 'S': case 's':
            case 'R': case 'r':
            case 'G': case 'g':
                break;
            default:
                throw std::runtime_error(
                    path.string() + ":" + std::to_string(lineNo)
                    + ": illegal map character '" + std::string(1, c) + "'"
                );
            }
        }

        floors.back().push_back(trimmed);
        if (static_cast<int>(floors.back().size()) > kMaxMapHeight) {
            throw std::runtime_error(path.string() + ": floor too tall");
        }
    }

    // Drop trailing empty floor
    while (!floors.empty() && floors.back().empty()) {
        floors.pop_back();
    }
    if (floors.empty()) {
        throw std::runtime_error(path.string() + ": no grid data");
    }

    std::size_t width = 0;
    for (const auto& fl : floors) {
        for (const auto& row : fl) {
            width = std::max(width, row.size());
        }
    }
    if (width > static_cast<std::size_t>(kMaxMapWidth)) {
        throw std::runtime_error(path.string() + ": map too wide");
    }

    int maxH = 0;
    for (const auto& fl : floors) {
        maxH = std::max(maxH, static_cast<int>(fl.size()));
    }
    if (static_cast<int>(width) < kMinMapWidth || maxH < kMinMapHeight) {
        throw std::runtime_error(path.string() + ": map too small");
    }

    // Normalize all floors to same height (pad with wall rows)
    for (auto& fl : floors) {
        while (static_cast<int>(fl.size()) < maxH) {
            fl.emplace_back(std::string(width, '1'));
        }
    }

    map.m_width      = static_cast<int>(width);
    map.m_height     = maxH;
    map.m_floorCount = static_cast<int>(floors.size());
    map.m_cells.assign(
        static_cast<std::size_t>(map.m_floorCount)
            * static_cast<std::size_t>(map.m_width)
            * static_cast<std::size_t>(map.m_height),
        Tile::Wall
    );

    for (int f = 0; f < map.m_floorCount; ++f) {
        auto& rows = floors[static_cast<std::size_t>(f)];
        for (int y = 0; y < map.m_height; ++y) {
            std::string row = rows[static_cast<std::size_t>(y)];
            if (row.size() < width) {
                row.append(width - row.size(), '1');
            }
            for (int x = 0; x < map.m_width; ++x) {
                const char c = row[static_cast<std::size_t>(x)];
                const auto idx = map.Index(f, x, y);

                if (c == 'P' || c == 'p') {
                    if (foundSpawn) {
                        throw std::runtime_error(path.string() + ": multiple P spawns");
                    }
                    foundSpawn   = true;
                    spawn.gridX  = x;
                    spawn.gridY  = y;
                    spawn.floor  = f;
                    spawn.facing = hasHeaderFacing ? headerFacing : Facing::East;
                    map.m_cells[idx] = Tile::Empty;
                    continue;
                }
                if (c == 'M' || c == 'm') {
                    map.m_enemySpawns.push_back(GridPoint{x, y, f});
                    map.m_cells[idx] = Tile::Empty;
                    continue;
                }
                map.m_cells[idx] = CharToTile(c);
            }
        }
    }

    if (!foundSpawn) {
        throw std::runtime_error(path.string() + ": missing player spawn 'P'");
    }

    map.m_spawn = spawn;
    map.Validate();
    return map;
}

std::optional<Map> Map::TryLoad(std::string_view filename)
{
    namespace fs = std::filesystem;
    const fs::path name(filename);
    const std::vector<fs::path> candidates = {
        name,
        fs::path("maps") / name.filename(),
        fs::path("..") / "maps" / name.filename(),
        fs::path("../..") / "maps" / name.filename(),
        fs::path("bin") / "maps" / name.filename(),
    };
    for (const auto& p : candidates) {
        std::error_code ec;
        if (!fs::exists(p, ec) || ec) {
            continue;
        }
        try {
            return LoadFromFile(p);
        } catch (...) {
        }
    }
    return std::nullopt;
}

std::size_t Map::Index(int floor, int x, int y) const noexcept
{
    return static_cast<std::size_t>(floor)
               * static_cast<std::size_t>(m_width)
               * static_cast<std::size_t>(m_height)
           + static_cast<std::size_t>(y) * static_cast<std::size_t>(m_width)
           + static_cast<std::size_t>(x);
}

bool Map::InBounds(int x, int y) const noexcept
{
    return x >= 0 && y >= 0 && x < m_width && y < m_height;
}

bool Map::ValidFloor(int floor) const noexcept
{
    return floor >= 0 && floor < m_floorCount;
}

Tile Map::At(int floor, int x, int y) const noexcept
{
    if (!ValidFloor(floor) || !InBounds(x, y)) {
        return Tile::Wall;
    }
    return m_cells[Index(floor, x, y)];
}

Tile* Map::AtMut(int floor, int x, int y) noexcept
{
    if (!ValidFloor(floor) || !InBounds(x, y)) {
        return nullptr;
    }
    return &m_cells[Index(floor, x, y)];
}

bool Map::IsSolid(int floor, int x, int y) const noexcept
{
    return At(floor, x, y) == Tile::Wall;
}

bool Map::IsWalkable(int floor, int x, int y) const noexcept
{
    return At(floor, x, y) != Tile::Wall;
}

bool Map::Collides(int floor, double worldX, double worldY, double radius) const noexcept
{
    const int minX = static_cast<int>(std::floor(worldX - radius));
    const int maxX = static_cast<int>(std::floor(worldX + radius));
    const int minY = static_cast<int>(std::floor(worldY - radius));
    const int maxY = static_cast<int>(std::floor(worldY + radius));

    for (int y = minY; y <= maxY; ++y) {
        for (int x = minX; x <= maxX; ++x) {
            if (!IsSolid(floor, x, y)) {
                continue;
            }
            const double nearestX =
                std::clamp(worldX, static_cast<double>(x), static_cast<double>(x) + 1.0);
            const double nearestY =
                std::clamp(worldY, static_cast<double>(y), static_cast<double>(y) + 1.0);
            const double dx = worldX - nearestX;
            const double dy = worldY - nearestY;
            if (dx * dx + dy * dy < radius * radius) {
                return true;
            }
        }
    }
    return false;
}

std::size_t Map::CoinCount() const noexcept
{
    return static_cast<std::size_t>(
        std::count(m_cells.begin(), m_cells.end(), Tile::Coin)
    );
}

std::size_t Map::CoinCountOnFloor(int floor) const noexcept
{
    if (!ValidFloor(floor)) {
        return 0;
    }
    std::size_t n = 0;
    for (int y = 0; y < m_height; ++y) {
        for (int x = 0; x < m_width; ++x) {
            if (At(floor, x, y) == Tile::Coin) {
                ++n;
            }
        }
    }
    return n;
}

bool Map::TryCollectCoinAt(int floor, double worldX, double worldY)
{
    const int x = static_cast<int>(std::floor(worldX));
    const int y = static_cast<int>(std::floor(worldY));
    Tile* cell  = AtMut(floor, x, y);
    if (cell == nullptr || *cell != Tile::Coin) {
        return false;
    }
    *cell = Tile::Empty;
    return true;
}

bool Map::TryPickupPistolAt(int floor, double worldX, double worldY)
{
    const int x = static_cast<int>(std::floor(worldX));
    const int y = static_cast<int>(std::floor(worldY));
    Tile* cell  = AtMut(floor, x, y);
    if (cell == nullptr || *cell != Tile::Weapon) {
        return false;
    }
    *cell = Tile::Empty;
    return true;
}

bool Map::TryPickupShotgunAt(int floor, double worldX, double worldY)
{
    const int x = static_cast<int>(std::floor(worldX));
    const int y = static_cast<int>(std::floor(worldY));
    Tile* cell  = AtMut(floor, x, y);
    if (cell == nullptr || *cell != Tile::Shotgun) {
        return false;
    }
    *cell = Tile::Empty;
    return true;
}

bool Map::TryPickupPortalGunAt(int floor, double worldX, double worldY)
{
    const int x = static_cast<int>(std::floor(worldX));
    const int y = static_cast<int>(std::floor(worldY));
    Tile* cell  = AtMut(floor, x, y);
    if (cell == nullptr || *cell != Tile::PortalGun) {
        return false;
    }
    *cell = Tile::Empty;
    return true;
}

bool Map::TryCollectAmmoAt(int floor, double worldX, double worldY)
{
    const int x = static_cast<int>(std::floor(worldX));
    const int y = static_cast<int>(std::floor(worldY));
    Tile* cell  = AtMut(floor, x, y);
    if (cell == nullptr || *cell != Tile::Ammo) {
        return false;
    }
    *cell = Tile::Empty;
    return true;
}

bool Map::IsOnExit(int floor, double worldX, double worldY) const noexcept
{
    const int x = static_cast<int>(std::floor(worldX));
    const int y = static_cast<int>(std::floor(worldY));
    return At(floor, x, y) == Tile::Exit;
}

bool Map::IsOnStairs(int floor, double worldX, double worldY) const noexcept
{
    const int x = static_cast<int>(std::floor(worldX));
    const int y = static_cast<int>(std::floor(worldY));
    return At(floor, x, y) == Tile::Stairs;
}

std::optional<int> Map::StairsDestinationFloor(int floor, int x, int y) const noexcept
{
    if (At(floor, x, y) != Tile::Stairs) {
        return std::nullopt;
    }
    // Prefer ascending (floor+1), then descending, then any other link.
    if (ValidFloor(floor + 1) && At(floor + 1, x, y) == Tile::Stairs) {
        return floor + 1;
    }
    if (ValidFloor(floor - 1) && At(floor - 1, x, y) == Tile::Stairs) {
        return floor - 1;
    }
    for (int f = 0; f < m_floorCount; ++f) {
        if (f == floor) {
            continue;
        }
        if (At(f, x, y) == Tile::Stairs) {
            return f;
        }
    }
    return std::nullopt;
}

Tile Map::CharToTile(char c)
{
    switch (c) {
    case '0':
        return Tile::Empty;
    case '1':
        return Tile::Wall;
    case 'C':
    case 'c':
        return Tile::Coin;
    case 'E':
    case 'e':
        return Tile::Exit;
    case 'W':
    case 'w':
        return Tile::Weapon;
    case 'A':
    case 'a':
        return Tile::Ammo;
    case 'S':
    case 's':
        return Tile::Stairs;
    case 'R':
    case 'r':
        return Tile::Shotgun;
    case 'G':
    case 'g':
        return Tile::PortalGun;
    default:
        return Tile::Empty;
    }
}

std::optional<Facing> Map::ParseFacing(std::string_view token)
{
    const std::string t = ToLower(Trim(token));
    if (t == "e" || t == "east" || t == "right") {
        return Facing::East;
    }
    if (t == "n" || t == "north" || t == "up") {
        return Facing::North;
    }
    if (t == "w" || t == "west" || t == "left") {
        return Facing::West;
    }
    if (t == "s" || t == "south" || t == "down") {
        return Facing::South;
    }
    return std::nullopt;
}

void Map::Validate() const
{
    if (m_width <= 0 || m_height <= 0 || m_floorCount <= 0) {
        throw std::runtime_error("Map has invalid dimensions");
    }
    const std::size_t expected =
        static_cast<std::size_t>(m_floorCount)
        * static_cast<std::size_t>(m_width)
        * static_cast<std::size_t>(m_height);
    if (m_cells.size() != expected) {
        throw std::runtime_error("Map cell buffer size mismatch");
    }
    if (!ValidFloor(m_spawn.floor) || !InBounds(m_spawn.gridX, m_spawn.gridY)) {
        throw std::runtime_error("Spawn is out of bounds");
    }
    if (IsSolid(m_spawn.floor, m_spawn.gridX, m_spawn.gridY)) {
        throw std::runtime_error("Spawn is inside a wall");
    }
}
