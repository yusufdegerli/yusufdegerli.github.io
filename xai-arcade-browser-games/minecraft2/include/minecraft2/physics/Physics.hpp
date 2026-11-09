#pragma once

#include "minecraft2/math/Vec3.hpp"
#include "minecraft2/world/Block.hpp"

namespace mc2 {

class World;

struct ColliderBox {
    float minX = 0, minY = 0, minZ = 0;
    float maxX = 0, maxY = 0, maxZ = 0;

    static ColliderBox fromCenterSize(const Vec3& center, float w, float h, float d)
    {
        const float hw = w * 0.5f;
        const float hd = d * 0.5f;
        ColliderBox b;
        b.minX = center.x - hw;
        b.maxX = center.x + hw;
        b.minY = center.y;
        b.maxY = center.y + h;
        b.minZ = center.z - hd;
        b.maxZ = center.z + hd;
        return b;
    }

    ColliderBox translated(float dx, float dy, float dz) const
    {
        ColliderBox b = *this;
        b.minX += dx; b.maxX += dx;
        b.minY += dy; b.maxY += dy;
        b.minZ += dz; b.maxZ += dz;
        return b;
    }
};

struct PhysicsBody {
    Vec3  position{0, 80, 0}; // feet position
    Vec3  velocity{0, 0, 0};
    float width  = 0.6f;
    float height = 1.8f;
    float depth  = 0.6f;
    bool  onGround = false;
    bool  inWater  = false;
    bool  noClip   = false; // creative fly / spectator
};

// Minecraft-like constants (tuned for ~20 TPS feel, scaled by dt).
namespace PhysicsConfig {
constexpr float Gravity        = 28.0f;
constexpr float TerminalVel    = 78.4f;
constexpr float JumpVelocity   = 9.0f;
constexpr float WalkSpeed      = 4.317f;
constexpr float SprintSpeed    = 5.612f;
constexpr float FlySpeed       = 10.9f;
constexpr float WaterDrag      = 0.8f;
constexpr float GroundFriction = 0.6f;
constexpr float AirDrag        = 0.98f;
} // namespace PhysicsConfig

bool aabbOverlapsSolid(const World& world, const ColliderBox& box);
bool isSolidAt(const World& world, int x, int y, int z);

// Move body with axis-separated collision resolution (classic voxel physics).
void moveAndCollide(World& world, PhysicsBody& body, float dt);

// Apply gravity + jump intent. jumpPressed = edge this frame.
void applyGravityAndJump(PhysicsBody& body, bool jumpPressed, bool creativeFly, float dt);

Vec3 eyePosition(const PhysicsBody& body, float eyeHeight = 1.62f);

} // namespace mc2
