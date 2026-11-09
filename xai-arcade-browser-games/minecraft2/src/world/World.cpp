#include "minecraft2/world/World.hpp"

#include "minecraft2/render/Shader.hpp"
#include "minecraft2/world/Redstone.hpp"
#include "minecraft2/world/Water.hpp"

#include <algorithm>
#include <memory>
#include <shared_mutex>
#include <cmath>
#include <iostream>
#include <thread>

namespace mc2 {
namespace {

std::size_t defaultWorkerCount()
{
    const unsigned hc = std::thread::hardware_concurrency();
    if (hc == 0) {
        return 2;
    }
    return static_cast<std::size_t>(std::max(2u, hc - 1u));
}

struct ChunkSnapshot {
    bool valid = false;
    int  cx    = 0;
    int  cz    = 0;
    std::array<Block, Chunk::VOLUME> blocks{};
};

Block sampleSnapshot(const ChunkSnapshot& snap, int worldX, int worldY, int worldZ)
{
    if (!snap.valid || worldY < 0 || worldY >= Chunk::SIZE_Y) {
        return Block{BlockId::Air};
    }
    const int lx = worldX - snap.cx * Chunk::SIZE_X;
    const int lz = worldZ - snap.cz * Chunk::SIZE_Z;
    if (lx < 0 || lx >= Chunk::SIZE_X || lz < 0 || lz >= Chunk::SIZE_Z) {
        return Block{BlockId::Air};
    }
    return snap.blocks[static_cast<std::size_t>(Chunk::indexOf(lx, worldY, lz))];
}

} // namespace

World::World(int worldSeed, int renderDistance, std::size_t workerThreads)
    : m_seed(worldSeed)
    , m_renderDistance(std::max(1, renderDistance))
    , m_pool(workerThreads == 0 ? defaultWorkerCount() : workerThreads)
{
    std::cout << "[World] seed=" << m_seed
              << " renderDistance=" << m_renderDistance
              << " workers=" << m_pool.workerCount() << '\n';
}

World::~World()
{
    m_shuttingDown.store(true);
    {
        std::unique_lock<std::shared_mutex> lock(m_mutex);
        m_chunks.clear();
    }
}

void World::setRenderDistance(int distance)
{
    m_renderDistance = std::max(1, distance);
}

std::size_t World::loadedChunkCount() const
{
    std::shared_lock<std::shared_mutex> lock(m_mutex);
    return m_chunks.size();
}

std::size_t World::pendingJobCount() const
{
    return static_cast<std::size_t>(std::max(0, m_jobsInFlight.load()));
}

World::ChunkEntry* World::findEntry(int cx, int cz)
{
    const auto it = m_chunks.find(ChunkCoord{cx, cz});
    return (it == m_chunks.end()) ? nullptr : it->second.get();
}

const World::ChunkEntry* World::findEntry(int cx, int cz) const
{
    const auto it = m_chunks.find(ChunkCoord{cx, cz});
    return (it == m_chunks.end()) ? nullptr : it->second.get();
}

World::ChunkEntry* World::getOrCreateEntry(int cx, int cz)
{
    ChunkCoord key{cx, cz};
    auto it = m_chunks.find(key);
    if (it != m_chunks.end()) {
        return it->second.get();
    }

    auto entry = std::make_unique<ChunkEntry>();
    entry->coord = key;
    entry->chunk = std::make_unique<Chunk>(cx, cz);
    entry->state = EntryState::Empty;
    entry->generationToken = 1;

    ChunkEntry* raw = entry.get();
    m_chunks.emplace(key, std::move(entry));
    return raw;
}

WorldBlockQuery World::makeBlockQuery() const
{
    return [this](int wx, int wy, int wz) -> Block {
        return getBlock(wx, wy, wz);
    };
}

Block World::getBlockUnlocked(int worldX, int worldY, int worldZ) const
{
    if (worldY < 0 || worldY >= Chunk::SIZE_Y) {
        return Block{BlockId::Air};
    }
    const int cx = worldToChunk(worldX);
    const int cz = worldToChunk(worldZ);
    const ChunkEntry* entry = findEntry(cx, cz);
    if (!entry || !entry->chunk || !entry->chunk->isTerrainReady()) {
        return Block{BlockId::Air};
    }
    return entry->chunk->getBlock(worldToLocal(worldX), worldY, worldToLocal(worldZ));
}

bool World::setBlockUnlocked(int worldX, int worldY, int worldZ, Block block)
{
    if (worldY < 0 || worldY >= Chunk::SIZE_Y) {
        return false;
    }
    const int cx = worldToChunk(worldX);
    const int cz = worldToChunk(worldZ);
    const int lx = worldToLocal(worldX);
    const int lz = worldToLocal(worldZ);
    ChunkEntry* entry = findEntry(cx, cz);
    if (!entry || !entry->chunk || !entry->chunk->isTerrainReady()) {
        return false;
    }
    const Block previous = entry->chunk->getBlock(lx, worldY, lz);
    if (previous == block) {
        return false;
    }
    entry->chunk->setBlock(lx, worldY, lz, block);
    entry->state = EntryState::TerrainReady;
    entry->meshJobQueued = false;

    auto dirtyNeighbor = [&](int ncx, int ncz) {
        if (ChunkEntry* n = findEntry(ncx, ncz)) {
            if (n->chunk && n->chunk->isTerrainReady()) {
                n->chunk->markDirty();
                n->state = EntryState::TerrainReady;
                n->meshJobQueued = false;
            }
        }
    };
    if (lx == 0) dirtyNeighbor(cx - 1, cz);
    if (lx == Chunk::SIZE_X - 1) dirtyNeighbor(cx + 1, cz);
    if (lz == 0) dirtyNeighbor(cx, cz - 1);
    if (lz == Chunk::SIZE_Z - 1) dirtyNeighbor(cx, cz + 1);
    return true;
}

Block World::getBlock(int worldX, int worldY, int worldZ) const
{
    if (worldY < 0 || worldY >= Chunk::SIZE_Y) {
        return Block{BlockId::Air};
    }

    const int cx = worldToChunk(worldX);
    const int cz = worldToChunk(worldZ);
    const int lx = worldToLocal(worldX);
    const int lz = worldToLocal(worldZ);

    std::shared_lock<std::shared_mutex> lock(m_mutex);
    const ChunkEntry* entry = findEntry(cx, cz);
    if (!entry || !entry->chunk || !entry->chunk->isTerrainReady()) {
        return Block{BlockId::Air};
    }
    return entry->chunk->getBlock(lx, worldY, lz);
}

bool World::setBlock(int worldX, int worldY, int worldZ, Block block)
{
    if (worldY < 0 || worldY >= Chunk::SIZE_Y) {
        return false;
    }

    const int cx = worldToChunk(worldX);
    const int cz = worldToChunk(worldZ);
    const int lx = worldToLocal(worldX);
    const int lz = worldToLocal(worldZ);

    std::unique_lock<std::shared_mutex> lock(m_mutex);
    ChunkEntry* entry = findEntry(cx, cz);
    if (!entry || !entry->chunk || !entry->chunk->isTerrainReady()) {
        return false;
    }

    const Block previous = entry->chunk->getBlock(lx, worldY, lz);
    if (previous == block) {
        return false;
    }

    entry->chunk->setBlock(lx, worldY, lz, block);
    entry->state = EntryState::TerrainReady;
    entry->meshJobQueued = false;

    auto dirtyNeighbor = [&](int ncx, int ncz) {
        if (ChunkEntry* n = findEntry(ncx, ncz)) {
            if (n->chunk && n->chunk->isTerrainReady()) {
                n->chunk->markDirty();
                n->state = EntryState::TerrainReady;
                n->meshJobQueued = false;
            }
        }
    };

    if (lx == 0) dirtyNeighbor(cx - 1, cz);
    if (lx == Chunk::SIZE_X - 1) dirtyNeighbor(cx + 1, cz);
    if (lz == 0) dirtyNeighbor(cx, cz - 1);
    if (lz == Chunk::SIZE_Z - 1) dirtyNeighbor(cx, cz + 1);

    return true;
}

bool World::breakBlock(int worldX, int worldY, int worldZ)
{
    const Block b = getBlock(worldX, worldY, worldZ);
    if (b.isAir() || b.id == BlockId::Bedrock) {
        return false;
    }
    return setBlock(worldX, worldY, worldZ, Block{BlockId::Air});
}

bool World::placeBlock(int worldX, int worldY, int worldZ, Block block)
{
    if (block.isAir()) {
        return false;
    }
    const Block existing = getBlock(worldX, worldY, worldZ);
    if (!isReplaceable(existing)) {
        return false;
    }
    return setBlock(worldX, worldY, worldZ, block);
}

void World::enqueueTerrain(ChunkEntry& entry)
{
    if (entry.genJobQueued || entry.state == EntryState::Generating ||
        (entry.chunk && entry.chunk->isTerrainReady())) {
        return;
    }

    entry.genJobQueued = true;
    entry.state = EntryState::Generating;

    const int cx = entry.coord.x;
    const int cz = entry.coord.z;
    const std::uint64_t token = entry.generationToken;
    const int seed = m_seed;

    m_jobsInFlight.fetch_add(1);
    m_pool.submit([this, cx, cz, token, seed]() {
        if (m_shuttingDown.load()) {
            m_jobsInFlight.fetch_sub(1);
            return;
        }

        // Heap-allocate generated chunk (128 KiB blocks — avoid worker stack overflow).
        auto local = std::make_unique<Chunk>(cx, cz);
        local->generateTerrain(seed);

        {
            std::unique_lock<std::shared_mutex> lock(m_mutex);
            ChunkEntry* entry = findEntry(cx, cz);
            if (!entry || entry->generationToken != token || !entry->chunk) {
                m_jobsInFlight.fetch_sub(1);
                return;
            }

            std::copy(local->data(), local->data() + Chunk::VOLUME, entry->chunk->data());
            entry->chunk->setTerrainReady(true);
            entry->chunk->bumpMeshRevision();
            entry->state = EntryState::TerrainReady;
            entry->genJobQueued = false;
            entry->meshJobQueued = false;
            markNeighborsNeedMesh(cx, cz);
        }

        m_jobsInFlight.fetch_sub(1);
    });
}

void World::enqueueMesh(ChunkEntry& entry)
{
    if (!entry.chunk || !entry.chunk->isTerrainReady()) {
        return;
    }
    if (entry.meshJobQueued || entry.state == EntryState::Meshing) {
        return;
    }

    if (entry.state == EntryState::Ready &&
        entry.lastUploadedRevision == entry.chunk->meshRevision() &&
        !entry.chunk->isDirty()) {
        return;
    }

    entry.meshJobQueued = true;
    entry.state = EntryState::Meshing;

    const int cx = entry.coord.x;
    const int cz = entry.coord.z;
    const std::uint64_t token = entry.generationToken;
    const std::uint64_t revision = entry.chunk->meshRevision();

    m_jobsInFlight.fetch_add(1);
    m_pool.submit([this, cx, cz, token, revision]() {
        if (m_shuttingDown.load()) {
            m_jobsInFlight.fetch_sub(1);
            return;
        }

        // Snapshots are ~128 KiB each — MUST be heap-allocated.
        // Secondary threads on macOS have a small stack; stack allocs SIGBUS via chkstk.
        auto center = std::make_unique<ChunkSnapshot>();
        auto neigh  = std::make_unique<std::array<ChunkSnapshot, 4>>();
        const int offs[4][2] = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};

        {
            std::unique_lock<std::shared_mutex> lock(m_mutex);
            ChunkEntry* entry = findEntry(cx, cz);
            if (!entry || entry->generationToken != token || !entry->chunk ||
                !entry->chunk->isTerrainReady()) {
                m_jobsInFlight.fetch_sub(1);
                return;
            }

            center->valid = true;
            center->cx = cx;
            center->cz = cz;
            std::copy(entry->chunk->data(), entry->chunk->data() + Chunk::VOLUME, center->blocks.begin());

            for (int i = 0; i < 4; ++i) {
                const int ncx = cx + offs[i][0];
                const int ncz = cz + offs[i][1];
                if (const ChunkEntry* n = findEntry(ncx, ncz)) {
                    if (n->chunk && n->chunk->isTerrainReady()) {
                        (*neigh)[i].valid = true;
                        (*neigh)[i].cx = ncx;
                        (*neigh)[i].cz = ncz;
                        std::copy(n->chunk->data(), n->chunk->data() + Chunk::VOLUME, (*neigh)[i].blocks.begin());
                    }
                }
            }

            entry->meshJobQueued = false;
            if (entry->chunk->meshRevision() == revision) {
                entry->chunk->clearDirty();
            }
        }

        // Temporary Chunk view for the mesher (heap — also 128 KiB of blocks).
        auto meshChunk = std::make_unique<Chunk>(cx, cz);
        std::copy(center->blocks.begin(), center->blocks.end(), meshChunk->data());
        meshChunk->setTerrainReady(true);

        ChunkMesh mesh;
        buildChunkMesh(*meshChunk, mesh, [&](int wx, int wy, int wz) -> Block {
            const int qcx = worldToChunk(wx);
            const int qcz = worldToChunk(wz);
            if (qcx == center->cx && qcz == center->cz) {
                return sampleSnapshot(*center, wx, wy, wz);
            }
            for (int i = 0; i < 4; ++i) {
                if ((*neigh)[i].valid && (*neigh)[i].cx == qcx && (*neigh)[i].cz == qcz) {
                    return sampleSnapshot((*neigh)[i], wx, wy, wz);
                }
            }
            return Block{BlockId::Air};
        });

        {
            std::lock_guard<std::mutex> lock(m_completeMutex);
            m_completedMeshes.push(CompletedMesh{ChunkCoord{cx, cz}, token, revision, std::move(mesh)});
        }

        m_jobsInFlight.fetch_sub(1);
    });
}

void World::markNeighborsNeedMesh(int cx, int cz)
{
    const int offs[4][2] = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
    for (const auto& o : offs) {
        if (ChunkEntry* n = findEntry(cx + o[0], cz + o[1])) {
            if (n->chunk && n->chunk->isTerrainReady()) {
                n->chunk->markDirty();
                if (n->state == EntryState::Ready || n->state == EntryState::TerrainReady) {
                    n->state = EntryState::TerrainReady;
                }
                n->meshJobQueued = false;
            }
        }
    }
}

void World::requestNeededChunks()
{
    for (int dz = -m_renderDistance; dz <= m_renderDistance; ++dz) {
        for (int dx = -m_renderDistance; dx <= m_renderDistance; ++dx) {
            if (dx * dx + dz * dz > m_renderDistance * m_renderDistance + m_renderDistance) {
                continue;
            }
            const int cx = m_playerChunkX.load(std::memory_order_relaxed) + dx;
            const int cz = m_playerChunkZ.load(std::memory_order_relaxed) + dz;
            ChunkEntry* entry = getOrCreateEntry(cx, cz);
            if (!entry->chunk->isTerrainReady() && !entry->genJobQueued &&
                entry->state != EntryState::Generating) {
                enqueueTerrain(*entry);
            }
        }
    }
}

void World::unloadFarChunks()
{
    const int keep = m_renderDistance + 1;
    std::vector<ChunkCoord> toRemove;

    for (const auto& kv : m_chunks) {
        const int pcx = m_playerChunkX.load(std::memory_order_relaxed);
        const int pcz = m_playerChunkZ.load(std::memory_order_relaxed);
        const int dx = kv.first.x - pcx;
        const int dz = kv.first.z - pcz;
        if (dx * dx + dz * dz > keep * keep) {
            toRemove.push_back(kv.first);
        }
    }

    for (const ChunkCoord& c : toRemove) {
        auto it = m_chunks.find(c);
        if (it == m_chunks.end()) {
            continue;
        }
        it->second->generationToken++;
        m_chunks.erase(it);
    }
}

void World::update(const Vec3& playerPosition)
{
    const int cx = static_cast<int>(std::floor(playerPosition.x / static_cast<float>(Chunk::SIZE_X)));
    const int cz = static_cast<int>(std::floor(playerPosition.z / static_cast<float>(Chunk::SIZE_Z)));

    std::unique_lock<std::shared_mutex> lock(m_mutex);

    const int prevCx = m_playerChunkX.load(std::memory_order_relaxed);
    const int prevCz = m_playerChunkZ.load(std::memory_order_relaxed);
    const bool chunkChanged = !m_playerChunkValid || cx != prevCx || cz != prevCz;
    m_playerChunkX.store(cx, std::memory_order_relaxed);
    m_playerChunkZ.store(cz, std::memory_order_relaxed);
    m_playerChunkValid = true;

    if (chunkChanged) {
        unloadFarChunks();
    }
    requestNeededChunks();

    int queued = 0;
    constexpr int kMaxMeshQueuesPerUpdate = 8;
    for (auto& kv : m_chunks) {
        ChunkEntry& e = *kv.second;
        if (!e.chunk || !e.chunk->isTerrainReady()) {
            continue;
        }
        const bool needsMesh =
            e.state == EntryState::TerrainReady ||
            e.chunk->isDirty() ||
            (e.state == EntryState::Ready && e.lastUploadedRevision != e.chunk->meshRevision());

        if (needsMesh && !e.meshJobQueued && e.state != EntryState::Meshing) {
            enqueueMesh(e);
            if (++queued >= kMaxMeshQueuesPerUpdate) {
                break;
            }
        }
    }
}

void World::pumpMainThread()
{
    std::queue<CompletedMesh> local;
    {
        std::lock_guard<std::mutex> lock(m_completeMutex);
        std::swap(local, m_completedMeshes);
    }

    while (!local.empty()) {
        CompletedMesh done = std::move(local.front());
        local.pop();

        std::unique_lock<std::shared_mutex> lock(m_mutex);
        ChunkEntry* entry = findEntry(done.coord.x, done.coord.z);
        if (!entry || entry->generationToken != done.token || !entry->chunk) {
            continue;
        }

        if (done.revision != entry->chunk->meshRevision()) {
            entry->state = EntryState::TerrainReady;
            entry->meshJobQueued = false;
            continue;
        }

        entry->renderer.uploadMesh(done.mesh);
        entry->lastUploadedRevision = done.revision;
        entry->state = EntryState::Ready;
        entry->chunk->clearDirty();
    }
}

void World::draw(const Shader& shader, const Frustum* frustum) const
{
    // shared_lock: multiple readers OK; sim/unload take unique_lock and wait for frame.
    // Pointers stay valid for the whole draw because unload can't run under shared.
    std::shared_lock<std::shared_mutex> lock(m_mutex);
    for (const auto& kv : m_chunks) {
        const ChunkEntry& e = *kv.second;
        if (!e.renderer.hasMesh() || !e.chunk) continue;
        if (frustum) {
            const float ox = float(e.coord.x * Chunk::SIZE_X);
            const float oz = float(e.coord.z * Chunk::SIZE_Z);
            AABB box;
            box.min = {ox, 0.f, oz};
            box.max = {ox + float(Chunk::SIZE_X), float(Chunk::SIZE_Y), oz + float(Chunk::SIZE_Z)};
            if (!frustum->intersectsAABB(box)) continue;
        }
        e.renderer.draw(shader, *e.chunk);
    }
}

void World::tickSimulation(int playerChunkX, int playerChunkZ)
{
    // Exclusive write lock for the entire fixed tick (water/redstone/falling).
    // Uses unlocked accessors underneath to avoid recursive locking.
    std::unique_lock<std::shared_mutex> lock(m_mutex);
    constexpr int kSimRadius = 1;
    tickFallingBlocks(*this, playerChunkX, playerChunkZ, kSimRadius);
    tickWater(*this, playerChunkX, playerChunkZ, kSimRadius);
    tickRedstone(*this, playerChunkX, playerChunkZ, kSimRadius);
}



} // namespace mc2
