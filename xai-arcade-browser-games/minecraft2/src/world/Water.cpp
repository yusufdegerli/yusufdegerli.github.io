#include "minecraft2/world/Water.hpp"

#include "minecraft2/world/Block.hpp"
#include "minecraft2/world/Chunk.hpp"
#include "minecraft2/world/World.hpp"

#include <algorithm>
#include <vector>

namespace mc2 {
namespace {

constexpr int kMaxLevel = 7; // meta 0 source, 1..7 flowing distance

int waterLevel(const Block& b)
{
    if (b.id != BlockId::Water) return 99;
    return static_cast<int>(b.meta & 0x0F);
}

} // namespace

void tickWater(World& world, int centerX, int centerZ, int radiusChunks)
{
    const int minCx = centerX - radiusChunks;
    const int maxCx = centerX + radiusChunks;
    const int minCz = centerZ - radiusChunks;
    const int maxCz = centerZ + radiusChunks;

    struct Change { int x, y, z; Block b; };
    std::vector<Change> changes;
    changes.reserve(1024);

    for (int cz = minCz; cz <= maxCz; ++cz) {
        for (int cx = minCx; cx <= maxCx; ++cx) {
            for (int lz = 0; lz < Chunk::SIZE_Z; ++lz) {
                for (int lx = 0; lx < Chunk::SIZE_X; ++lx) {
                    const int wx = cx * Chunk::SIZE_X + lx;
                    const int wz = cz * Chunk::SIZE_Z + lz;

                    for (int y = 1; y < 140; ++y) {
                        const Block self = world.getBlockUnlocked(wx, y, wz);
                        if (self.id != BlockId::Water) {
                            // Air cell: maybe receive water from neighbors (handled from source)
                            continue;
                        }

                        const int lvl = waterLevel(self);

                        // 1) Flow down
                        const Block below = world.getBlockUnlocked(wx, y - 1, wz);
                        if (below.isAir()) {
                            changes.push_back({wx, y - 1, wz, Block{BlockId::Water, 1}});
                        } else if (below.id == BlockId::Water && waterLevel(below) > 1) {
                            changes.push_back({wx, y - 1, wz, Block{BlockId::Water, 1}});
                        } else if (isSolid(below) && lvl < kMaxLevel) {
                            // 2) Spread sideways with increasing level
                            const int next = (lvl == 0) ? 1 : lvl + 1;
                            if (next <= kMaxLevel) {
                                const int dirs[4][2] = {{1,0},{-1,0},{0,1},{0,-1}};
                                for (auto& d : dirs) {
                                    const int nx = wx + d[0];
                                    const int nz = wz + d[1];
                                    const Block n = world.getBlockUnlocked(nx, y, nz);
                                    if (n.isAir()) {
                                        changes.push_back({nx, y, nz, Block{BlockId::Water, static_cast<std::uint8_t>(next)}});
                                    } else if (n.id == BlockId::Water && waterLevel(n) > next) {
                                        changes.push_back({nx, y, nz, Block{BlockId::Water, static_cast<std::uint8_t>(next)}});
                                    }
                                }
                            }
                        }

                        // 3) Non-source water dries if unsupported
                        if (lvl > 0) {
                            bool supported = false;
                            const Block above = world.getBlockUnlocked(wx, y + 1, wz);
                            if (above.id == BlockId::Water) supported = true;
                            const int dirs[4][2] = {{1,0},{-1,0},{0,1},{0,-1}};
                            for (auto& d : dirs) {
                                const Block n = world.getBlockUnlocked(wx + d[0], y, wz + d[1]);
                                if (n.id == BlockId::Water && waterLevel(n) < lvl) {
                                    supported = true;
                                    break;
                                }
                                if (n.id == BlockId::Water && waterLevel(n) == 0) {
                                    supported = true;
                                    break;
                                }
                            }
                            if (!supported && !isSolid(world.getBlockUnlocked(wx, y - 1, wz))) {
                                // falling handled by flow down
                            } else if (!supported) {
                                // dry up gradually
                                if (lvl >= kMaxLevel) {
                                    changes.push_back({wx, y, wz, Block{BlockId::Air}});
                                } else {
                                    changes.push_back({wx, y, wz, Block{BlockId::Water, static_cast<std::uint8_t>(lvl + 1)}});
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    for (const Change& c : changes) {
        world.setBlockUnlocked(c.x, c.y, c.z, c.b);
    }
}

} // namespace mc2
