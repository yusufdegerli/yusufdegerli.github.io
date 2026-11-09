#pragma once

#include "minecraft2/world/Block.hpp"

#include <array>
#include <cstddef>
#include <cstdint>

namespace mc2 {

// Minecraft 1.7.10 chunk: 16 × 256 × 16, flat 1D storage.
// index = x + (z << 4) + (y << 8)
class Chunk {
public:
    static constexpr int SIZE_X    = 16;
    static constexpr int SIZE_Y    = 256;
    static constexpr int SIZE_Z    = 16;
    static constexpr int SECTION_Y = 16;
    static constexpr int SECTIONS  = SIZE_Y / SECTION_Y;
    static constexpr int VOLUME    = SIZE_X * SIZE_Y * SIZE_Z; // 65536

    Chunk();
    Chunk(int chunkX, int chunkZ);

    int chunkX() const { return m_chunkX; }
    int chunkZ() const { return m_chunkZ; }
    void setChunkPos(int chunkX, int chunkZ);

    static constexpr int indexOf(int x, int y, int z)
    {
        return x + (z << 4) + (y << 8);
    }

    static constexpr void coordsOf(int index, int& x, int& y, int& z)
    {
        x = index & 15;
        z = (index >> 4) & 15;
        y = index >> 8;
    }

    static constexpr int sectionIndex(int y) { return y >> 4; }
    static constexpr int localYInSection(int y) { return y & 15; }

    static constexpr bool inBounds(int x, int y, int z)
    {
        return x >= 0 && x < SIZE_X && y >= 0 && y < SIZE_Y && z >= 0 && z < SIZE_Z;
    }

    Block getBlock(int x, int y, int z) const;
    void  setBlock(int x, int y, int z, Block block);
    void  moveBlock(int x, int y, int z, Block block) { setBlock(x, y, z, block); }

    Block getBlockByIndex(int index) const;
    void  setBlockByIndex(int index, Block block);

    Block getBlockOrAir(int x, int y, int z) const;

    const Block* data() const { return m_blocks.data(); }
    Block*       data() { return m_blocks.data(); }

    bool isDirty() const { return m_dirty; }
    void markDirty() { m_dirty = true; }
    void clearDirty() { m_dirty = false; }

    bool isTerrainReady() const { return m_terrainReady; }
    void setTerrainReady(bool ready) { m_terrainReady = ready; }

    // Procedural terrain via FastNoiseLite (heightmap + dirt/stone/grass layers).
    // Safe to call from a worker thread (no OpenGL).
    void generateTerrain(int worldSeed);

    void worldOrigin(float& outX, float& outY, float& outZ) const;

    // Mesh revision bumped on every edit / terrain gen — workers check this.
    std::uint64_t meshRevision() const { return m_meshRevision; }
    void bumpMeshRevision() { ++m_meshRevision; m_dirty = true; }

private:
    int m_chunkX = 0;
    int m_chunkZ = 0;
    bool m_dirty = true;
    bool m_terrainReady = false;
    std::uint64_t m_meshRevision = 1;

    std::array<Block, VOLUME> m_blocks{};
};

// Integer floor-division that works for negative world coords.
inline int floorDiv(int a, int b)
{
    const int q = a / b;
    const int r = a % b;
    if ((r != 0) && ((r < 0) != (b < 0))) {
        return q - 1;
    }
    return q;
}

inline int worldToChunk(int worldCoord)
{
    return floorDiv(worldCoord, Chunk::SIZE_X);
}

inline int worldToLocal(int worldCoord)
{
    const int c = worldToChunk(worldCoord);
    return worldCoord - c * Chunk::SIZE_X;
}

} // namespace mc2
