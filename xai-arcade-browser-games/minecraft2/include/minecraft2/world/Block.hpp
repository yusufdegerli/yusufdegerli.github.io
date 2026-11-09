#pragma once

#include <cstdint>

namespace mc2 {

struct Block {
    std::uint8_t id   = 0;
    std::uint8_t meta = 0; // water level 0-7, redstone power 0-15, etc.

    constexpr Block() = default;
    constexpr explicit Block(std::uint8_t blockId, std::uint8_t metadata = 0)
        : id(blockId)
        , meta(metadata)
    {
    }

    constexpr bool isAir() const { return id == 0; }
    constexpr bool operator==(const Block& o) const { return id == o.id && meta == o.meta; }
    constexpr bool operator!=(const Block& o) const { return !(*this == o); }
};

namespace BlockId {
constexpr std::uint8_t Air           = 0;
constexpr std::uint8_t Stone         = 1;
constexpr std::uint8_t Grass         = 2;
constexpr std::uint8_t Dirt          = 3;
constexpr std::uint8_t Cobble        = 4;
constexpr std::uint8_t Planks        = 5;
constexpr std::uint8_t Bedrock       = 7;
constexpr std::uint8_t Water         = 9;
constexpr std::uint8_t Sand          = 12;
constexpr std::uint8_t Gravel        = 13;
constexpr std::uint8_t GoldOre       = 14;
constexpr std::uint8_t IronOre       = 15;
constexpr std::uint8_t CoalOre       = 16;
constexpr std::uint8_t Log           = 17;
constexpr std::uint8_t Leaves        = 18;
constexpr std::uint8_t RedstoneOre   = 73;
constexpr std::uint8_t RedstoneTorch = 76;
constexpr std::uint8_t RedstoneDust  = 55;
constexpr std::uint8_t DiamondOre    = 56;
} // namespace BlockId

// Collision: water is NOT solid; plants/etc. non-solid later.
inline bool isSolid(const Block& b)
{
    if (b.isAir()) return false;
    if (b.id == BlockId::Water) return false;
    if (b.id == BlockId::RedstoneDust) return false;
    if (b.id == BlockId::RedstoneTorch) return false;
    return true;
}

inline bool isLiquid(const Block& b) { return b.id == BlockId::Water; }

inline bool isGravityBlock(const Block& b)
{
    return b.id == BlockId::Sand || b.id == BlockId::Gravel;
}

inline bool isReplaceable(const Block& b)
{
    return b.isAir() || b.id == BlockId::Water || b.id == BlockId::RedstoneDust;
}

inline bool isOpaqueForAO(const Block& b)
{
    // Used by ambient occlusion — liquids don't occlude corners.
    return isSolid(b);
}

inline void blockTileCoords(std::uint8_t blockId, int& tileX, int& tileY)
{
    tileY = 0;
    switch (blockId) {
    case BlockId::Stone:         tileX = 0; break;
    case BlockId::Grass:         tileX = 1; break;
    case BlockId::Dirt:          tileX = 2; break;
    case BlockId::Cobble:        tileX = 3; break;
    case BlockId::Planks:        tileX = 5; break;
    case BlockId::Bedrock:       tileX = 8; break;
    case BlockId::Sand:          tileX = 7; break;
    case BlockId::Gravel:        tileX = 3; tileY = 1; break;
    case BlockId::Log:           tileX = 5; break;
    case BlockId::Leaves:        tileX = 9; break;
    case BlockId::Water:         tileX = 6; break;
    case BlockId::CoalOre:       tileX = 0; tileY = 1; break;
    case BlockId::IronOre:       tileX = 1; tileY = 1; break;
    case BlockId::GoldOre:       tileX = 2; tileY = 1; break;
    case BlockId::DiamondOre:    tileX = 3; tileY = 1; break;
    case BlockId::RedstoneDust:  tileX = 4; tileY = 1; break;
    case BlockId::RedstoneTorch: tileX = 5; tileY = 1; break;
    case BlockId::RedstoneOre:   tileX = 6; tileY = 1; break;
    default:                     tileX = 0; break;
    }
}

inline void grassSideTile(int& tileX, int& tileY)
{
    tileX = 4;
    tileY = 0;
}

} // namespace mc2
