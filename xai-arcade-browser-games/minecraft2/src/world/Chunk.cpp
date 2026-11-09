#include "minecraft2/world/Chunk.hpp"
#include <FastNoiseLite.h>
#include <algorithm>
#include <cmath>
#include <cstdlib>

namespace mc2 {

Chunk::Chunk() { m_blocks.fill(Block{BlockId::Air}); }
Chunk::Chunk(int chunkX, int chunkZ) : m_chunkX(chunkX), m_chunkZ(chunkZ) {
    m_blocks.fill(Block{BlockId::Air});
}

void Chunk::setChunkPos(int chunkX, int chunkZ) {
    m_chunkX = chunkX; m_chunkZ = chunkZ; m_dirty = true;
}

Block Chunk::getBlock(int x, int y, int z) const {
    if (!inBounds(x, y, z)) return Block{BlockId::Air};
    return m_blocks[static_cast<std::size_t>(indexOf(x, y, z))];
}

void Chunk::setBlock(int x, int y, int z, Block block) {
    if (!inBounds(x, y, z)) return;
    m_blocks[static_cast<std::size_t>(indexOf(x, y, z))] = block;
    bumpMeshRevision();
}

Block Chunk::getBlockByIndex(int index) const {
    if (index < 0 || index >= VOLUME) return Block{BlockId::Air};
    return m_blocks[static_cast<std::size_t>(index)];
}

void Chunk::setBlockByIndex(int index, Block block) {
    if (index < 0 || index >= VOLUME) return;
    m_blocks[static_cast<std::size_t>(index)] = block;
    bumpMeshRevision();
}

Block Chunk::getBlockOrAir(int x, int y, int z) const {
    if (!inBounds(x, y, z)) return Block{BlockId::Air};
    return getBlock(x, y, z);
}

void Chunk::worldOrigin(float& outX, float& outY, float& outZ) const {
    outX = float(m_chunkX * SIZE_X);
    outY = 0.f;
    outZ = float(m_chunkZ * SIZE_Z);
}

void Chunk::generateTerrain(int worldSeed) {
    m_blocks.fill(Block{BlockId::Air});

    FastNoiseLite continental;
    continental.SetSeed(worldSeed);
    continental.SetNoiseType(FastNoiseLite::NoiseType_OpenSimplex2);
    continental.SetFrequency(0.0035f);
    continental.SetFractalType(FastNoiseLite::FractalType_FBm);
    continental.SetFractalOctaves(4);

    FastNoiseLite detail;
    detail.SetSeed(worldSeed + 17);
    detail.SetNoiseType(FastNoiseLite::NoiseType_Perlin);
    detail.SetFrequency(0.02f);
    detail.SetFractalType(FastNoiseLite::FractalType_FBm);
    detail.SetFractalOctaves(3);

    FastNoiseLite ridge;
    ridge.SetSeed(worldSeed + 91);
    ridge.SetNoiseType(FastNoiseLite::NoiseType_OpenSimplex2);
    ridge.SetFrequency(0.008f);
    ridge.SetFractalType(FastNoiseLite::FractalType_Ridged);
    ridge.SetFractalOctaves(3);

    FastNoiseLite caveNoise;
    caveNoise.SetSeed(worldSeed + 123);
    caveNoise.SetNoiseType(FastNoiseLite::NoiseType_OpenSimplex2);
    caveNoise.SetFrequency(0.045f);

    FastNoiseLite oreNoise;
    oreNoise.SetSeed(worldSeed + 777);
    oreNoise.SetNoiseType(FastNoiseLite::NoiseType_OpenSimplex2);
    oreNoise.SetFrequency(0.12f);

    const int baseX = m_chunkX * SIZE_X;
    const int baseZ = m_chunkZ * SIZE_Z;
    constexpr int kSeaLevel = 62;
    constexpr int kBaseHeight = 64;

    for (int z = 0; z < SIZE_Z; ++z) {
        for (int x = 0; x < SIZE_X; ++x) {
            const float wx = float(baseX + x);
            const float wz = float(baseZ + z);
            const float c = continental.GetNoise(wx, wz);
            const float d = detail.GetNoise(wx, wz);
            const float r = ridge.GetNoise(wx, wz);
            float heightF = float(kBaseHeight) + c * 28.f + d * 10.f + r * 18.f;
            int surface = std::clamp((int)std::lround(heightF), 4, SIZE_Y - 2);

            for (int y = 0; y <= surface; ++y) {
                Block b{BlockId::Stone};
                if (y == 0) b = Block{BlockId::Bedrock};
                else if (y > surface - 4 && y < surface) b = Block{BlockId::Dirt};
                else if (y == surface) {
                    if (surface < kSeaLevel - 1) b = Block{BlockId::Dirt};
                    else if (surface <= kSeaLevel + 1) b = Block{BlockId::Sand};
                    else b = Block{BlockId::Grass};
                }

                // Caves
                if (y > 4 && y < surface - 2) {
                    const float cave = caveNoise.GetNoise(wx * 0.9f, float(y) * 1.35f, wz * 0.9f);
                    if (cave > 0.60f) b = Block{BlockId::Air};
                }

                // Ores in stone only
                if (b.id == BlockId::Stone) {
                    const float o = oreNoise.GetNoise(wx * 1.7f, float(y) * 2.1f, wz * 1.7f);
                    // Coal: common, y 5-128
                    if (y >= 5 && y <= 128 && o > 0.72f) b = Block{BlockId::CoalOre};
                    // Iron: y 5-64
                    else if (y >= 5 && y <= 64 && o > 0.78f && o < 0.86f) b = Block{BlockId::IronOre};
                    // Gold: y 5-32
                    else if (y >= 5 && y <= 32 && o > 0.86f && o < 0.91f) b = Block{BlockId::GoldOre};
                    // Diamond: very deep near bedrock, y 1-16
                    else if (y >= 1 && y <= 16 && o > 0.91f) b = Block{BlockId::DiamondOre};
                    // Redstone ore deep
                    else if (y >= 1 && y <= 20 && o > 0.68f && o < 0.72f) b = Block{BlockId::RedstoneOre};
                }

                m_blocks[static_cast<std::size_t>(indexOf(x, y, z))] = b;
            }

            // Ocean fill
            if (surface < kSeaLevel) {
                for (int y = surface + 1; y <= kSeaLevel; ++y)
                    m_blocks[static_cast<std::size_t>(indexOf(x, y, z))] = Block{BlockId::Water, 0};
            }
        }
    }

    m_terrainReady = true;
    bumpMeshRevision();
}

} // namespace mc2
