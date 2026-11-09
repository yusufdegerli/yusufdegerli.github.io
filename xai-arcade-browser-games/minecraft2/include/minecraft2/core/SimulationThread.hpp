#pragma once

#include "minecraft2/entity/Entities.hpp"
#include "minecraft2/math/Vec3.hpp"

#include <atomic>
#include <chrono>
#include <mutex>
#include <thread>
#include <vector>

namespace mc2 {

class World;

// Fixed-rate game logic loop (20 TPS) running OFF the OpenGL/render thread.
// Owns water, redstone, falling blocks, and entity updates.
class SimulationThread {
public:
    static constexpr int   kTicksPerSecond = 20;
    static constexpr float kFixedDelta     = 1.0f / float(kTicksPerSecond);

    SimulationThread(World& world, EntitySystem& entities);
    ~SimulationThread();

    SimulationThread(const SimulationThread&) = delete;
    SimulationThread& operator=(const SimulationThread&) = delete;

    void start();
    void stop();

    // Main thread: enable only while in the playing screen.
    void setEnabled(bool enabled) { m_enabled.store(enabled, std::memory_order_relaxed); }
    bool enabled() const { return m_enabled.load(std::memory_order_relaxed); }

    // Main thread: publish latest player pose/state for AI (non-blocking copy).
    void publishPlayer(const PlayerState& player);

    // Main thread: pull a renderable entity snapshot (double-buffered).
    std::vector<EntityRenderCube> entitySnapshot() const;

    // Main thread: apply sim-side effects (damage, knockback) to the live player.
    void drainPlayerEffects(PlayerState& player);

    std::uint64_t tickCount() const { return m_tickCount.load(std::memory_order_relaxed); }

private:
    void threadMain();
    void fixedUpdate();

    World&        m_world;
    EntitySystem& m_entities;

    std::thread       m_thread;
    std::atomic<bool> m_running{false};
    std::atomic<bool> m_enabled{false};
    std::atomic<std::uint64_t> m_tickCount{0};

    // Player sample for AI (written by main, read by sim)
    mutable std::mutex m_playerSampleMutex;
    PlayerState        m_playerSample{};

    // Effects sim -> main
    struct PlayerEffect {
        float damage = 0.f;
        Vec3  impulse{};
    };
    mutable std::mutex m_effectMutex;
    PlayerEffect       m_pendingEffect{};

    // Entity render double-buffer
    mutable std::mutex m_renderMutex;
    std::vector<EntityRenderCube> m_renderCubes;

    bool m_spawnedMobs = false;
};

} // namespace mc2
