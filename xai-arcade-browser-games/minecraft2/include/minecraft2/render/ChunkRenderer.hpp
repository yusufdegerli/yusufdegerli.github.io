#pragma once

#include "minecraft2/math/Mat4.hpp"
#include "minecraft2/render/ChunkMesh.hpp"

namespace mc2 {

class Chunk;
class Shader;

class ChunkRenderer {
public:
    ChunkRenderer() = default;
    ~ChunkRenderer();
    ChunkRenderer(const ChunkRenderer&) = delete;
    ChunkRenderer& operator=(const ChunkRenderer&) = delete;
    ChunkRenderer(ChunkRenderer&& other) noexcept;
    ChunkRenderer& operator=(ChunkRenderer&& other) noexcept;

    void rebuild(const Chunk& chunk);
    void uploadMesh(const ChunkMesh& mesh);
    void draw(const Shader& shader, const Chunk& chunk) const;

    bool hasMesh() const { return m_indexCount > 0; }
    unsigned int indexCount() const { return m_indexCount; }

private:
    void destroy();
    void upload(const ChunkMesh& mesh);
    unsigned int m_vao = 0, m_vbo = 0, m_ebo = 0;
    unsigned int m_indexCount = 0;
};

} // namespace mc2
