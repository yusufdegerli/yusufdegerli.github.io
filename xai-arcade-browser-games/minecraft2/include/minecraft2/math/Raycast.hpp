#pragma once

#include "minecraft2/math/Vec3.hpp"

namespace mc2 {

class World;

// Result of a DDA voxel traversal (Amanatides & Woo style).
struct RaycastHit {
    bool hit = false;

    // Solid block that was hit (world coords).
    int blockX = 0;
    int blockY = 0;
    int blockZ = 0;

    // Previous empty cell along the ray (where a new block would be placed).
    int prevX = 0;
    int prevY = 0;
    int prevZ = 0;

    // Outward normal of the hit face (axis-aligned: components in {-1,0,1}).
    int normalX = 0;
    int normalY = 0;
    int normalZ = 0;

    float distance = 0.0f;
};

// Traverse voxels from origin along direction (need not be unit) up to maxDistance.
// Hits the first non-air, non-water solid-ish block (water is skipped so you can
// mine through oceans / place against terrain under water).
RaycastHit raycastDDA(const World& world,
                      const Vec3& origin,
                      const Vec3& direction,
                      float maxDistance = 6.0f);

} // namespace mc2
