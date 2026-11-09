#include "minecraft2/math/Raycast.hpp"

#include "minecraft2/world/Block.hpp"
#include "minecraft2/world/World.hpp"

#include <cmath>

namespace mc2 {
namespace {

bool isTargetBlock(const Block& b)
{
    // Break/place against solids; skip air and water.
    return !b.isAir() && b.id != BlockId::Water;
}

int floorInt(float v)
{
    return static_cast<int>(std::floor(v));
}

} // namespace

RaycastHit raycastDDA(const World& world,
                      const Vec3& origin,
                      const Vec3& direction,
                      float maxDistance)
{
    RaycastHit result;

    Vec3 dir = direction;
    const float len = dir.length();
    if (len < 1e-8f || maxDistance <= 0.0f) {
        return result;
    }
    dir = dir / len;

    // Current voxel
    int x = floorInt(origin.x);
    int y = floorInt(origin.y);
    int z = floorInt(origin.z);

    const int stepX = (dir.x > 0.0f) ? 1 : ((dir.x < 0.0f) ? -1 : 0);
    const int stepY = (dir.y > 0.0f) ? 1 : ((dir.y < 0.0f) ? -1 : 0);
    const int stepZ = (dir.z > 0.0f) ? 1 : ((dir.z < 0.0f) ? -1 : 0);

    // tDelta: how far along the ray we must travel to cross one voxel on each axis
    const float tDeltaX = (stepX != 0) ? std::abs(1.0f / dir.x) : 1e30f;
    const float tDeltaY = (stepY != 0) ? std::abs(1.0f / dir.y) : 1e30f;
    const float tDeltaZ = (stepZ != 0) ? std::abs(1.0f / dir.z) : 1e30f;

    // tMax: distance along ray to the first boundary on each axis
    auto initTMax = [](float originComp, float dirComp, int voxel, int step) -> float {
        if (step == 0) {
            return 1e30f;
        }
        if (step > 0) {
            return (static_cast<float>(voxel + 1) - originComp) / dirComp;
        }
        return (originComp - static_cast<float>(voxel)) / (-dirComp);
    };

    float tMaxX = initTMax(origin.x, dir.x, x, stepX);
    float tMaxY = initTMax(origin.y, dir.y, y, stepY);
    float tMaxZ = initTMax(origin.z, dir.z, z, stepZ);

    int prevX = x;
    int prevY = y;
    int prevZ = z;
    int lastNormalX = 0;
    int lastNormalY = 0;
    int lastNormalZ = 0;

    float t = 0.0f;

    // Safety cap so we never infinite-loop on degenerate inputs.
    const int maxSteps = static_cast<int>(maxDistance * 3.0f) + 16;

    for (int i = 0; i < maxSteps; ++i) {
        if (t > maxDistance) {
            break;
        }

        // World height clamp
        if (y >= 0 && y < 256) {
            const Block b = world.getBlock(x, y, z);
            if (isTargetBlock(b)) {
                result.hit     = true;
                result.blockX  = x;
                result.blockY  = y;
                result.blockZ  = z;
                result.prevX   = prevX;
                result.prevY   = prevY;
                result.prevZ   = prevZ;
                result.normalX = lastNormalX;
                result.normalY = lastNormalY;
                result.normalZ = lastNormalZ;
                result.distance = t;
                return result;
            }
        }

        prevX = x;
        prevY = y;
        prevZ = z;

        // Step to next voxel boundary (smallest tMax)
        if (tMaxX < tMaxY) {
            if (tMaxX < tMaxZ) {
                t = tMaxX;
                tMaxX += tDeltaX;
                x += stepX;
                lastNormalX = -stepX;
                lastNormalY = 0;
                lastNormalZ = 0;
            } else {
                t = tMaxZ;
                tMaxZ += tDeltaZ;
                z += stepZ;
                lastNormalX = 0;
                lastNormalY = 0;
                lastNormalZ = -stepZ;
            }
        } else {
            if (tMaxY < tMaxZ) {
                t = tMaxY;
                tMaxY += tDeltaY;
                y += stepY;
                lastNormalX = 0;
                lastNormalY = -stepY;
                lastNormalZ = 0;
            } else {
                t = tMaxZ;
                tMaxZ += tDeltaZ;
                z += stepZ;
                lastNormalX = 0;
                lastNormalY = 0;
                lastNormalZ = -stepZ;
            }
        }
    }

    return result;
}

} // namespace mc2
