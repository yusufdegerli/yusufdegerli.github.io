#pragma once

#include "minecraft2/math/Vec3.hpp"
#include "minecraft2/physics/Physics.hpp"
#include "minecraft2/world/Block.hpp"

#include <cstdint>
#include <vector>

namespace mc2 {

class World;

enum class EntityType : std::uint8_t {
    Player = 0,
    Zombie,
    Pig,
    Cow,
    Sheep
};

enum class GameMode : std::uint8_t {
    Survival = 0,
    Creative = 1
};

struct Entity {
    EntityType type = EntityType::Pig;
    PhysicsBody body{};
    float health = 10.0f;
    float maxHealth = 10.0f;
    float yaw = 0.0f;
    float hurtTimer = 0.0f;
    float aiTimer = 0.0f;
    float aiYaw = 0.0f;
    bool  alive = true;
    int   id = 0;
};

struct PlayerState {
    PhysicsBody body{};
    GameMode mode = GameMode::Survival;
    float health = 20.0f;
    float maxHealth = 20.0f;
    float food = 20.0f;
    float maxFood = 20.0f;
    float yaw = -90.0f;
    float pitch = 0.0f;
    int   selectedSlot = 0;
    Block hotbar[9]{};
    Block inventory[27]{};
    bool  inventoryOpen = false;
    float attackCooldown = 0.0f;

    PlayerState()
    {
        body.width = 0.6f;
        body.height = 1.8f;
        body.depth = 0.6f;
        hotbar[0] = Block{BlockId::Stone};
        hotbar[1] = Block{BlockId::Dirt};
        hotbar[2] = Block{BlockId::Grass};
        hotbar[3] = Block{BlockId::Cobble};
        hotbar[4] = Block{BlockId::Sand};
        hotbar[5] = Block{BlockId::Log};
        hotbar[6] = Block{BlockId::RedstoneDust};
        hotbar[7] = Block{BlockId::RedstoneTorch};
        hotbar[8] = Block{BlockId::Water};
    }

    Block& selectedBlock() { return hotbar[selectedSlot]; }
    const Block& selectedBlock() const { return hotbar[selectedSlot]; }
};

class EntitySystem {
public:
    void clear();
    void spawnAmbient(World& world, const Vec3& around, int count);
    void spawnZombie(const Vec3& pos);
    void update(World& world, PlayerState& player, float dt);
    const std::vector<Entity>& entities() const { return m_entities; }
    std::vector<Entity>& entities() { return m_entities; }

private:
    void updateZombie(Entity& e, World& world, PlayerState& player, float dt);
    void updateAnimal(Entity& e, World& world, float dt);
    int m_nextId = 1;
    std::vector<Entity> m_entities;
};

struct EntityRenderCube {
    Vec3  pos;
    float w, h, d;
    float r, g, b;
    EntityType type;
};

std::vector<EntityRenderCube> gatherEntityCubes(const EntitySystem& sys);

} // namespace mc2
