#include "minecraft2/core/SimulationThread.hpp"

#include "minecraft2/world/World.hpp"

#include <algorithm>
#include <iostream>

namespace mc2 {

SimulationThread::SimulationThread(World& world, EntitySystem& entities)
    : m_world(world)
    , m_entities(entities)
{
}

SimulationThread::~SimulationThread()
{
    stop();
}

void SimulationThread::start()
{
    if (m_running.exchange(true)) {
        return;
    }
    m_thread = std::thread([this] { threadMain(); });
    std::cout << "[Sim] Fixed " << kTicksPerSecond << " TPS thread started (off GL thread)\n";
}

void SimulationThread::stop()
{
    if (!m_running.exchange(false)) {
        return;
    }
    if (m_thread.joinable()) {
        m_thread.join();
    }
    std::cout << "[Sim] Thread stopped\n";
}

void SimulationThread::publishPlayer(const PlayerState& player)
{
    std::lock_guard<std::mutex> lock(m_playerSampleMutex);
    // Copy only fields the sim needs for AI / attacks
    m_playerSample.body     = player.body;
    m_playerSample.mode     = player.mode;
    m_playerSample.health   = player.health;
    m_playerSample.yaw      = player.yaw;
    m_playerSample.pitch    = player.pitch;
}

std::vector<EntityRenderCube> SimulationThread::entitySnapshot() const
{
    std::lock_guard<std::mutex> lock(m_renderMutex);
    return m_renderCubes;
}

void SimulationThread::drainPlayerEffects(PlayerState& player)
{
    PlayerEffect e;
    {
        std::lock_guard<std::mutex> lock(m_effectMutex);
        e = m_pendingEffect;
        m_pendingEffect = {};
    }
    if (e.damage > 0.f && player.mode == GameMode::Survival) {
        player.health = std::max(0.f, player.health - e.damage);
        player.body.velocity += e.impulse;
    }
}

void SimulationThread::threadMain()
{
    using clock = std::chrono::steady_clock;
    const auto step = std::chrono::duration_cast<clock::duration>(
        std::chrono::duration<double>(kFixedDelta));

    auto nextTick = clock::now();

    while (m_running.load(std::memory_order_relaxed)) {
        nextTick += step;

        if (m_enabled.load(std::memory_order_relaxed)) {
            fixedUpdate();
            m_tickCount.fetch_add(1, std::memory_order_relaxed);
        }

        // Fixed cadence: sleep until next tick. If we fell behind, skip catch-up
        // spirals (drop ticks) so the sim never floods the world mutex.
        const auto now = clock::now();
        if (nextTick + step < now) {
            // More than one tick late — resync (drop backlog).
            nextTick = now;
        } else if (now < nextTick) {
            std::this_thread::sleep_until(nextTick);
        }
    }
}

void SimulationThread::fixedUpdate()
{
    // 1) Block dynamics at 20 TPS (water / redstone / falling) — single-lock batch inside.
    const int pcx = m_world.playerChunkX();
    const int pcz = m_world.playerChunkZ();
    m_world.tickSimulation(pcx, pcz);

    // 2) Entities + AI
    PlayerState playerCopy;
    {
        std::lock_guard<std::mutex> lock(m_playerSampleMutex);
        playerCopy = m_playerSample;
    }

    const float healthBefore = playerCopy.health;
    const Vec3  velBefore    = playerCopy.body.velocity;

    if (!m_spawnedMobs && m_world.loadedChunkCount() > 8) {
        m_entities.spawnAmbient(m_world, playerCopy.body.position, 8);
        m_spawnedMobs = true;
    }

    m_entities.update(m_world, playerCopy, kFixedDelta);

    // 3) Collect damage/knockback applied to the sample player
    {
        std::lock_guard<std::mutex> lock(m_effectMutex);
        if (playerCopy.health < healthBefore) {
            m_pendingEffect.damage += (healthBefore - playerCopy.health);
        }
        m_pendingEffect.impulse.x += playerCopy.body.velocity.x - velBefore.x;
        m_pendingEffect.impulse.y += playerCopy.body.velocity.y - velBefore.y;
        m_pendingEffect.impulse.z += playerCopy.body.velocity.z - velBefore.z;
    }

    // 4) Publish render snapshot (no GL here)
    auto cubes = gatherEntityCubes(m_entities);
    {
        std::lock_guard<std::mutex> lock(m_renderMutex);
        m_renderCubes.swap(cubes);
    }
}

} // namespace mc2
