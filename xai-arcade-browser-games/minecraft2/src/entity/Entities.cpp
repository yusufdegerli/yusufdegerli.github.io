#include "minecraft2/entity/Entities.hpp"
#include "minecraft2/world/World.hpp"

#include <algorithm>
#include <cmath>
#include <cstdlib>

namespace mc2 {
namespace {
float randf(float a, float b) {
    return a + (b - a) * (static_cast<float>(std::rand()) / static_cast<float>(RAND_MAX));
}
float angleTo(float fx, float fz, float tx, float tz) {
    return std::atan2(tz - fz, tx - fx) * (180.0f / 3.14159265f);
}
void moveTowardYaw(PhysicsBody& body, float yawDeg, float speed) {
    const float r = yawDeg * (3.14159265f / 180.0f);
    body.velocity.x = std::cos(r) * speed;
    body.velocity.z = std::sin(r) * speed;
}
} // namespace

void EntitySystem::clear() { m_entities.clear(); }

void EntitySystem::spawnZombie(const Vec3& pos) {
    Entity e;
    e.type = EntityType::Zombie;
    e.body.position = pos;
    e.body.width = 0.6f; e.body.height = 1.95f; e.body.depth = 0.6f;
    e.health = e.maxHealth = 20.0f;
    e.id = m_nextId++;
    m_entities.push_back(e);
}

void EntitySystem::spawnAmbient(World& world, const Vec3& around, int count) {
    for (int i = 0; i < count; ++i) {
        Entity e;
        const int roll = std::rand() % 3;
        e.type = (roll == 0) ? EntityType::Pig : ((roll == 1) ? EntityType::Cow : EntityType::Sheep);
        e.body.width = 0.9f;
        e.body.height = (e.type == EntityType::Cow) ? 1.4f : 0.9f;
        e.body.depth = 0.9f;
        e.health = e.maxHealth = 10.0f;
        e.id = m_nextId++;
        for (int tries = 0; tries < 16; ++tries) {
            const float x = around.x + randf(-24.f, 24.f);
            const float z = around.z + randf(-24.f, 24.f);
            int y = 120;
            while (y > 1 && !isSolid(world.getBlock((int)std::floor(x), y, (int)std::floor(z)))) --y;
            e.body.position = {x, (float)(y + 1), z};
            if (isSolid(world.getBlock((int)x, y, (int)z))) break;
        }
        m_entities.push_back(e);
    }
    for (int i = 0; i < 2; ++i)
        spawnZombie({around.x + randf(-20, 20), around.y + 2.f, around.z + randf(-20, 20)});
}

void EntitySystem::updateZombie(Entity& e, World& world, PlayerState& player, float dt) {
    if (!e.alive) return;
    e.hurtTimer = std::max(0.f, e.hurtTimer - dt);
    const Vec3& pp = player.body.position;
    const float dx = pp.x - e.body.position.x;
    const float dz = pp.z - e.body.position.z;
    const float distSq = dx * dx + dz * dz;
    e.yaw = angleTo(e.body.position.x, e.body.position.z, pp.x, pp.z);
    if (distSq < 16.f * 16.f) {
        moveTowardYaw(e.body, e.yaw, 2.8f);
        if (e.body.onGround && std::abs(e.body.velocity.x) + std::abs(e.body.velocity.z) < 0.15f)
            e.body.velocity.y = PhysicsConfig::JumpVelocity * 0.85f;
    } else {
        e.body.velocity.x *= 0.8f; e.body.velocity.z *= 0.8f;
    }
    applyGravityAndJump(e.body, false, false, dt);
    moveAndCollide(world, e.body, dt);
    if (distSq < 1.4f * 1.4f && e.hurtTimer <= 0.f && player.mode == GameMode::Survival) {
        player.health = std::max(0.f, player.health - 2.f);
        e.hurtTimer = 1.f;
        const float len = std::sqrt(distSq) + 1e-4f;
        player.body.velocity.x += (dx / len) * -4.f;
        player.body.velocity.z += (dz / len) * -4.f;
        player.body.velocity.y += 3.f;
    }
}

void EntitySystem::updateAnimal(Entity& e, World& world, float dt) {
    if (!e.alive) return;
    e.aiTimer -= dt;
    if (e.aiTimer <= 0.f) {
        e.aiTimer = randf(1.5f, 4.f);
        e.aiYaw = (randf(0, 1) < 0.3f) ? -1.f : randf(0.f, 360.f);
    }
    if (e.aiYaw >= 0.f) { e.yaw = e.aiYaw; moveTowardYaw(e.body, e.yaw, 1.4f); }
    else { e.body.velocity.x *= 0.7f; e.body.velocity.z *= 0.7f; }
    applyGravityAndJump(e.body, false, false, dt);
    moveAndCollide(world, e.body, dt);
}

void EntitySystem::update(World& world, PlayerState& player, float dt) {
    for (Entity& e : m_entities) {
        if (!e.alive) continue;
        if (e.type == EntityType::Zombie) updateZombie(e, world, player, dt);
        else updateAnimal(e, world, dt);
        const float dx = e.body.position.x - player.body.position.x;
        const float dz = e.body.position.z - player.body.position.z;
        if (dx * dx + dz * dz > 96.f * 96.f) e.alive = false;
    }
    m_entities.erase(std::remove_if(m_entities.begin(), m_entities.end(),
        [](const Entity& e){ return !e.alive; }), m_entities.end());
}

std::vector<EntityRenderCube> gatherEntityCubes(const EntitySystem& sys) {
    std::vector<EntityRenderCube> out;
    for (const Entity& e : sys.entities()) {
        if (!e.alive) continue;
        EntityRenderCube c{e.body.position, e.body.width, e.body.height, e.body.depth, 1,1,1, e.type};
        switch (e.type) {
        case EntityType::Zombie: c.r=0.2f; c.g=0.55f; c.b=0.2f; break;
        case EntityType::Pig:    c.r=0.95f; c.g=0.65f; c.b=0.7f; break;
        case EntityType::Cow:    c.r=0.45f; c.g=0.3f; c.b=0.2f; break;
        case EntityType::Sheep:  c.r=0.9f; c.g=0.9f; c.b=0.9f; break;
        default: break;
        }
        out.push_back(c);
    }
    return out;
}
} // namespace mc2
