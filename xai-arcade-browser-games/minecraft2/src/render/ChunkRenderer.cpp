#include "minecraft2/render/ChunkRenderer.hpp"
#include "minecraft2/render/Shader.hpp"
#include "minecraft2/world/Chunk.hpp"
#include <glad/gl.h>
#include <utility>

namespace mc2 {

ChunkRenderer::~ChunkRenderer() { destroy(); }

ChunkRenderer::ChunkRenderer(ChunkRenderer&& o) noexcept
    : m_vao(o.m_vao), m_vbo(o.m_vbo), m_ebo(o.m_ebo), m_indexCount(o.m_indexCount) {
    o.m_vao = o.m_vbo = o.m_ebo = 0; o.m_indexCount = 0;
}

ChunkRenderer& ChunkRenderer::operator=(ChunkRenderer&& o) noexcept {
    if (this != &o) {
        destroy();
        m_vao=o.m_vao; m_vbo=o.m_vbo; m_ebo=o.m_ebo; m_indexCount=o.m_indexCount;
        o.m_vao=o.m_vbo=o.m_ebo=0; o.m_indexCount=0;
    }
    return *this;
}

void ChunkRenderer::destroy() {
    if (m_vao) glDeleteVertexArrays(1, &m_vao);
    if (m_vbo) glDeleteBuffers(1, &m_vbo);
    if (m_ebo) glDeleteBuffers(1, &m_ebo);
    m_vao = m_vbo = m_ebo = m_indexCount = 0;
}

void ChunkRenderer::upload(const ChunkMesh& mesh) {
    if (!m_vao) {
        glGenVertexArrays(1, &m_vao);
        glGenBuffers(1, &m_vbo);
        glGenBuffers(1, &m_ebo);
    }
    glBindVertexArray(m_vao);
    glBindBuffer(GL_ARRAY_BUFFER, m_vbo);
    glBufferData(GL_ARRAY_BUFFER, (GLsizeiptr)(mesh.vertices.size()*sizeof(float)),
                 mesh.vertices.empty()?nullptr:mesh.vertices.data(), GL_STATIC_DRAW);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, m_ebo);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, (GLsizeiptr)(mesh.indices.size()*sizeof(unsigned)),
                 mesh.indices.empty()?nullptr:mesh.indices.data(), GL_STATIC_DRAW);

    const GLsizei stride = 6 * sizeof(float);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, stride, (void*)0);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, stride, (void*)(3*sizeof(float)));
    glEnableVertexAttribArray(2);
    glVertexAttribPointer(2, 1, GL_FLOAT, GL_FALSE, stride, (void*)(5*sizeof(float)));
    glBindVertexArray(0);
    m_indexCount = (unsigned)mesh.indices.size();
}

void ChunkRenderer::uploadMesh(const ChunkMesh& mesh) { upload(mesh); }

void ChunkRenderer::rebuild(const Chunk& chunk) {
    ChunkMesh mesh;
    buildChunkMesh(chunk, mesh);
    upload(mesh);
}

void ChunkRenderer::draw(const Shader& shader, const Chunk& chunk) const {
    if (!m_indexCount || !m_vao) return;
    float ox, oy, oz;
    chunk.worldOrigin(ox, oy, oz);
    shader.setMat4("model", Mat4::translate({ox, oy, oz}));
    glBindVertexArray(m_vao);
    glDrawElements(GL_TRIANGLES, (GLsizei)m_indexCount, GL_UNSIGNED_INT, nullptr);
    glBindVertexArray(0);
}

} // namespace mc2
