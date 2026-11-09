#pragma once

#include "minecraft2/core/ThreadPool.hpp"
#include "minecraft2/math/Frustum.hpp"
#include "minecraft2/math/Vec3.hpp"
#include "minecraft2/render/ChunkMesh.hpp"
#include "minecraft2/render/ChunkRenderer.hpp"
#include "minecraft2/world/Block.hpp"
#include "minecraft2/world/Chunk.hpp"

#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <memory>
#include <mutex>
#include <shared_mutex>
#include <queue>
#include <unordered_map>
#include <utility>
#include <vector>

namespace mc2 {

class Shader;

struct ChunkCoord {
    int x = 0;
    int z = 0;

    bool operator==(const ChunkCoord& o) const { return x == o.x && z == o.z; }
};

struct ChunkCoordHash {
    std::size_t operator()(const ChunkCoord& c) const noexcept
    {
        // 64-bit mix of two 32-bit coords (works well for sparse chunk grids).
        const auto a = static_cast<std::uint64_t>(static_cast<std::uint32_t>(c.x));
        const auto b = static_cast<std::uint64_t>(static_cast<std::uint32_t>(c.z));
        return static_cast<std::size_t>(a * 73856093ull ^ b * 19349663ull);
    }
};

// Streaming voxel world: load / unload by render distance, async gen + mesh.
class World {
public:
    explicit World(int worldSeed = 1337,
                   int renderDistance = 6,
                   std::size_t workerThreads = 0);
    ~World();

    World(const World&) = delete;
    World& operator=(const World&) = delete;

    int seed() const { return m_seed; }
    int renderDistance() const { return m_renderDistance; }
    void setRenderDistance(int distance);

    // Player footprint in chunk coordinates (lock-free for sim thread).
    int playerChunkX() const { return m_playerChunkX.load(std::memory_order_relaxed); }
    int playerChunkZ() const { return m_playerChunkZ.load(std::memory_order_relaxed); }

    // Call every frame with camera/player world position.
    void update(const Vec3& playerPosition);

    // Main-thread only: upload finished meshes, free GPU for unloaded chunks.
    void pumpMainThread();

    void draw(const Shader& shader, const Frustum* frustum = nullptr) const;

    // Fixed-step block simulation. Safe from the SimulationThread.
    // Holds the world mutex once and batches water/redstone/falling.
    void tickSimulation(int playerChunkX, int playerChunkZ);

    // Unlocked block access — ONLY while holding the world simulation/write lock
    // (i.e. from inside tickSimulation or exclusive()). Prefer these in bulk ticks.
    Block getBlockUnlocked(int worldX, int worldY, int worldZ) const;
    bool  setBlockUnlocked(int worldX, int worldY, int worldZ, Block block);

    // Run callback while holding exclusive world write lock.
    template <typename Fn>
    void exclusive(Fn&& fn)
    {
        std::unique_lock<std::shared_mutex> lock(m_mutex);
        fn();
    }


    Block getBlock(int worldX, int worldY, int worldZ) const;
    bool  setBlock(int worldX, int worldY, int worldZ, Block block);

    // Break solid at world pos (Air). Returns true if changed.
    bool breakBlock(int worldX, int worldY, int worldZ);
    // Place block if cell is air/water. Returns true if changed.
    bool placeBlock(int worldX, int worldY, int worldZ, Block block);

    std::size_t loadedChunkCount() const;
    std::size_t pendingJobCount() const;

private:
    enum class EntryState {
        Empty,          // allocated, waiting for terrain job
        Generating,     // terrain job in flight
        TerrainReady,   // blocks ready, needs mesh
        Meshing,        // mesh job in flight
        Ready           // GPU mesh available (may still be dirty → remesh)
    };

    struct ChunkEntry {
        ChunkCoord coord{};
        std::unique_ptr<Chunk> chunk;
        ChunkRenderer renderer;
        EntryState state = EntryState::Empty;
        bool meshJobQueued = false;
        bool genJobQueued  = false;
        std::uint64_t lastUploadedRevision = 0;
        std::uint64_t generationToken = 0; // invalidated on unload
    };

    struct CompletedMesh {
        ChunkCoord coord{};
        std::uint64_t token = 0;
        std::uint64_t revision = 0;
        ChunkMesh mesh;
    };

    ChunkEntry* findEntry(int cx, int cz);
    const ChunkEntry* findEntry(int cx, int cz) const;
    ChunkEntry* getOrCreateEntry(int cx, int cz);

    void enqueueTerrain(ChunkEntry& entry);
    void enqueueMesh(ChunkEntry& entry);
    void markNeighborsNeedMesh(int cx, int cz);
    void unloadFarChunks();
    void requestNeededChunks();

    WorldBlockQuery makeBlockQuery() const;

    int m_seed = 1337;
    int m_renderDistance = 6;
    std::atomic<int> m_playerChunkX{0};
    std::atomic<int> m_playerChunkZ{0};
    bool m_playerChunkValid = false;

    mutable std::shared_mutex m_mutex; // shared=readers/draw, unique=writers/sim
    std::unordered_map<ChunkCoord, std::unique_ptr<ChunkEntry>, ChunkCoordHash> m_chunks;

    ThreadPool m_pool;

    std::mutex m_completeMutex;
    std::queue<CompletedMesh> m_completedMeshes;

    std::atomic<int> m_jobsInFlight{0};
    std::atomic<bool> m_shuttingDown{false};
};

} // namespace mc2
