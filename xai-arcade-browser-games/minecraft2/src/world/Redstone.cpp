#include "minecraft2/world/Redstone.hpp"

#include "minecraft2/world/Block.hpp"
#include "minecraft2/world/Chunk.hpp"
#include "minecraft2/world/World.hpp"

#include <algorithm>
#include <queue>
#include <utility>
#include <vector>

namespace mc2 {
namespace {

struct Pos { int x, y, z; };

} // namespace

void tickRedstone(World& world, int centerChunkX, int centerChunkZ, int radiusChunks)
{
    const int minX = (centerChunkX - radiusChunks) * Chunk::SIZE_X;
    const int maxX = (centerChunkX + radiusChunks + 1) * Chunk::SIZE_X - 1;
    const int minZ = (centerChunkZ - radiusChunks) * Chunk::SIZE_Z;
    const int maxZ = (centerChunkZ + radiusChunks + 1) * Chunk::SIZE_Z - 1;

    // Collect dust cells and clear power, then BFS from torches.
    std::vector<Pos> dust;
    std::queue<std::pair<Pos, int>> q;

    for (int z = minZ; z <= maxZ; ++z) {
        for (int x = minX; x <= maxX; ++x) {
            for (int y = 0; y < 128; ++y) {
                const Block b = world.getBlockUnlocked(x, y, z);
                if (b.id == BlockId::RedstoneDust) {
                    dust.push_back({x, y, z});
                    if (b.meta != 0) {
                        world.setBlockUnlocked(x, y, z, Block{BlockId::RedstoneDust, 0});
                    }
                } else if (b.id == BlockId::RedstoneTorch) {
                    q.push({{x, y, z}, 15});
                }
            }
        }
    }

    auto tryPowerDust = [&](int x, int y, int z, int power) {
        if (power <= 0) return;
        if (x < minX || x > maxX || z < minZ || z > maxZ || y < 0 || y >= Chunk::SIZE_Y) return;
        const Block b = world.getBlockUnlocked(x, y, z);
        if (b.id != BlockId::RedstoneDust) return;
        if (static_cast<int>(b.meta) >= power) return;
        world.setBlockUnlocked(x, y, z, Block{BlockId::RedstoneDust, static_cast<std::uint8_t>(power)});
        q.push({{x, y, z}, power});
    };

    // Seed: torch powers adjacent dust
    std::queue<std::pair<Pos, int>> seeds = q;
    while (!seeds.empty()) {
        const auto [p, pow] = seeds.front();
        seeds.pop();
        const int dirs[6][3] = {{1,0,0},{-1,0,0},{0,1,0},{0,-1,0},{0,0,1},{0,0,-1}};
        for (auto& d : dirs) {
            tryPowerDust(p.x + d[0], p.y + d[1], p.z + d[2], 15);
        }
    }

    // Propagate along dust, decreasing by 1 each step (max range 15).
    // Re-read queue of powered dust from above tryPowerDust seeds.
    // Rebuild queue from current powered dust:
    std::queue<std::pair<Pos, int>> work;
    for (const Pos& p : dust) {
        const Block b = world.getBlockUnlocked(p.x, p.y, p.z);
        if (b.id == BlockId::RedstoneDust && b.meta > 0) {
            work.push({p, static_cast<int>(b.meta)});
        }
    }

    while (!work.empty()) {
        const auto [p, pow] = work.front();
        work.pop();
        if (pow <= 1) continue;
        const int next = pow - 1;
        const int dirs[4][2] = {{1,0},{-1,0},{0,1},{0,-1}};
        for (auto& d : dirs) {
            const int nx = p.x + d[0];
            const int nz = p.z + d[1];
            // same y, and up/down one for step-up dust
            for (int dy = -1; dy <= 1; ++dy) {
                const int ny = p.y + dy;
                const Block nb = world.getBlockUnlocked(nx, ny, nz);
                if (nb.id == BlockId::RedstoneDust && static_cast<int>(nb.meta) < next) {
                    world.setBlockUnlocked(nx, ny, nz, Block{BlockId::RedstoneDust, static_cast<std::uint8_t>(next)});
                    work.push({{nx, ny, nz}, next});
                }
            }
        }
    }
}

void tickFallingBlocks(World& world, int centerChunkX, int centerChunkZ, int radiusChunks)
{
    const int minX = (centerChunkX - radiusChunks) * Chunk::SIZE_X;
    const int maxX = (centerChunkX + radiusChunks + 1) * Chunk::SIZE_X - 1;
    const int minZ = (centerChunkZ - radiusChunks) * Chunk::SIZE_Z;
    const int maxZ = (centerChunkZ + radiusChunks + 1) * Chunk::SIZE_Z - 1;

    // Bottom-up so stacks fall correctly one step per tick.
    for (int y = 1; y < 128; ++y) {
        for (int z = minZ; z <= maxZ; ++z) {
            for (int x = minX; x <= maxX; ++x) {
                const Block b = world.getBlockUnlocked(x, y, z);
                if (!isGravityBlock(b)) continue;
                const Block below = world.getBlockUnlocked(x, y - 1, z);
                if (below.isAir() || isLiquid(below)) {
                    world.setBlockUnlocked(x, y - 1, z, b);
                    world.setBlockUnlocked(x, y, z, Block{BlockId::Air});
                }
            }
        }
    }
}

} // namespace mc2
