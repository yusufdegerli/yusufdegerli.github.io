#include "minecraft2/physics/Physics.hpp"

#include "minecraft2/world/World.hpp"

#include <algorithm>
#include <cmath>

namespace mc2 {

bool isSolidAt(const World& world, int x, int y, int z)
{
    return isSolid(world.getBlock(x, y, z));
}

bool aabbOverlapsSolid(const World& world, const ColliderBox& box)
{
    const int minX = static_cast<int>(std::floor(box.minX));
    const int maxX = static_cast<int>(std::floor(box.maxX));
    const int minY = static_cast<int>(std::floor(box.minY));
    const int maxY = static_cast<int>(std::floor(box.maxY));
    const int minZ = static_cast<int>(std::floor(box.minZ));
    const int maxZ = static_cast<int>(std::floor(box.maxZ));

    for (int y = minY; y <= maxY; ++y) {
        for (int z = minZ; z <= maxZ; ++z) {
            for (int x = minX; x <= maxX; ++x) {
                if (isSolidAt(world, x, y, z)) {
                    return true;
                }
            }
        }
    }
    return false;
}

namespace {

bool bodyInWater(const World& world, const PhysicsBody& body)
{
    const ColliderBox box = ColliderBox::fromCenterSize(body.position, body.width, body.height, body.depth);
    const int minX = static_cast<int>(std::floor(box.minX));
    const int maxX = static_cast<int>(std::floor(box.maxX));
    const int minY = static_cast<int>(std::floor(box.minY));
    const int maxY = static_cast<int>(std::floor(box.maxY));
    const int minZ = static_cast<int>(std::floor(box.minZ));
    const int maxZ = static_cast<int>(std::floor(box.maxZ));
    for (int y = minY; y <= maxY; ++y) {
        for (int z = minZ; z <= maxZ; ++z) {
            for (int x = minX; x <= maxX; ++x) {
                if (isLiquid(world.getBlock(x, y, z))) {
                    return true;
                }
            }
        }
    }
    return false;
}

} // namespace

void moveAndCollide(World& world, PhysicsBody& body, float dt)
{
    if (body.noClip) {
        body.position += body.velocity * dt;
        body.onGround = false;
        body.inWater  = bodyInWater(world, body);
        return;
    }

    // Cap velocity
    body.velocity.y = std::clamp(body.velocity.y, -PhysicsConfig::TerminalVel, PhysicsConfig::TerminalVel);

    Vec3 delta = body.velocity * dt;
    body.onGround = false;

    // --- Y axis ---
    {
        body.position.y += delta.y;
        ColliderBox box = ColliderBox::fromCenterSize(body.position, body.width * 0.99f, body.height, body.depth * 0.99f);
        if (aabbOverlapsSolid(world, box)) {
            if (delta.y < 0.0f) {
                // Landing — snap feet to top of block
                const int footY = static_cast<int>(std::floor(box.minY));
                body.position.y = static_cast<float>(footY + 1) + 0.001f;
                body.onGround = true;
            } else if (delta.y > 0.0f) {
                const int headY = static_cast<int>(std::floor(box.maxY));
                body.position.y = static_cast<float>(headY) - body.height - 0.001f;
            }
            body.velocity.y = 0.0f;
        }
    }

    // --- X axis ---
    {
        body.position.x += delta.x;
        ColliderBox box = ColliderBox::fromCenterSize(body.position, body.width, body.height * 0.99f, body.depth * 0.99f);
        if (aabbOverlapsSolid(world, box)) {
            body.position.x -= delta.x;
            body.velocity.x = 0.0f;
        }
    }

    // --- Z axis ---
    {
        body.position.z += delta.z;
        ColliderBox box = ColliderBox::fromCenterSize(body.position, body.width * 0.99f, body.height * 0.99f, body.depth);
        if (aabbOverlapsSolid(world, box)) {
            body.position.z -= delta.z;
            body.velocity.z = 0.0f;
        }
    }

    body.inWater = bodyInWater(world, body);
}

void applyGravityAndJump(PhysicsBody& body, bool jumpPressed, bool creativeFly, float dt)
{
    if (creativeFly || body.noClip) {
        // No gravity in creative fly — vertical controlled externally.
        return;
    }

    if (body.inWater) {
        body.velocity.y -= PhysicsConfig::Gravity * 0.3f * dt;
        body.velocity.y *= PhysicsConfig::WaterDrag;
        if (jumpPressed) {
            body.velocity.y = 4.0f; // swim up
        }
    } else {
        body.velocity.y -= PhysicsConfig::Gravity * dt;
        if (jumpPressed && body.onGround) {
            body.velocity.y = PhysicsConfig::JumpVelocity;
            body.onGround = false;
        }
    }
}

Vec3 eyePosition(const PhysicsBody& body, float eyeHeight)
{
    return {body.position.x, body.position.y + eyeHeight, body.position.z};
}

} // namespace mc2
