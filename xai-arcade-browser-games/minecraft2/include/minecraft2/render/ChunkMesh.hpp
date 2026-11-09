#pragma once

#include "minecraft2/world/Block.hpp"
#include <functional>
#include <vector>

namespace mc2 {

class Chunk;

// Interleaved: position(3) + uv(2) + ao(1)  =>  6 floats
struct ChunkMesh {
    std::vector<float> vertices;
    std::vector<unsigned int> indices;
    void clear() { vertices.clear(); indices.clear(); }
    bool empty() const { return indices.empty(); }
    std::size_t indexCount() const { return indices.size(); }
};

using WorldBlockQuery = std::function<Block(int worldX, int worldY, int worldZ)>;

void buildChunkMesh(const Chunk& chunk, ChunkMesh& outMesh, const WorldBlockQuery& query);
void buildChunkMesh(const Chunk& chunk, ChunkMesh& outMesh);

} // namespace mc2
