#include "minecraft2/render/ChunkMesh.hpp"
#include "minecraft2/world/Chunk.hpp"

namespace mc2 {
namespace {

constexpr int kFaceNormals[6][3] = {
    {1,0,0},{-1,0,0},{0,1,0},{0,-1,0},{0,0,1},{0,0,-1}
};

// BL,BR,TR,TL — CCW from outside
constexpr float kFaceVerts[6][4][3] = {
    {{1,0,1},{1,0,0},{1,1,0},{1,1,1}},
    {{0,0,0},{0,0,1},{0,1,1},{0,1,0}},
    {{0,1,1},{1,1,1},{1,1,0},{0,1,0}},
    {{0,0,0},{1,0,0},{1,0,1},{0,0,1}},
    {{0,0,1},{1,0,1},{1,1,1},{0,1,1}},
    {{1,0,0},{0,0,0},{0,1,0},{1,1,0}},
};

// For each face, for each corner (BL,BR,TR,TL): two side offsets + corner offset
// used for ambient occlusion (classic Minecraft vertex AO).
// Offsets are relative to the face's outward-adjacent plane.
// sideA, sideB, corner — in block coords relative to the solid block.
constexpr int kAOOffsets[6][4][3][3] = {
    // +X : sides along Y and Z
    { // BL(1,0,1) sides -Y +Z
      {{0,-1,0},{0,0,1},{0,-1,1}},
      {{0,-1,0},{0,0,-1},{0,-1,-1}},
      {{0,1,0},{0,0,-1},{0,1,-1}},
      {{0,1,0},{0,0,1},{0,1,1}},
    },
    // -X
    {
      {{0,-1,0},{0,0,-1},{0,-1,-1}},
      {{0,-1,0},{0,0,1},{0,-1,1}},
      {{0,1,0},{0,0,1},{0,1,1}},
      {{0,1,0},{0,0,-1},{0,1,-1}},
    },
    // +Y
    {
      {{0,0,1},{-1,0,0},{-1,0,1}},
      {{0,0,1},{1,0,0},{1,0,1}},
      {{0,0,-1},{1,0,0},{1,0,-1}},
      {{0,0,-1},{-1,0,0},{-1,0,-1}},
    },
    // -Y
    {
      {{0,0,-1},{-1,0,0},{-1,0,-1}},
      {{0,0,-1},{1,0,0},{1,0,-1}},
      {{0,0,1},{1,0,0},{1,0,1}},
      {{0,0,1},{-1,0,0},{-1,0,1}},
    },
    // +Z
    {
      {{0,-1,0},{-1,0,0},{-1,-1,0}},
      {{0,-1,0},{1,0,0},{1,-1,0}},
      {{0,1,0},{1,0,0},{1,1,0}},
      {{0,1,0},{-1,0,0},{-1,1,0}},
    },
    // -Z
    {
      {{0,-1,0},{1,0,0},{1,-1,0}},
      {{0,-1,0},{-1,0,0},{-1,-1,0}},
      {{0,1,0},{-1,0,0},{-1,1,0}},
      {{0,1,0},{1,0,0},{1,1,0}},
    },
};

constexpr float kFaceCornerUV[4][2] = {{0,0},{1,0},{1,1},{0,1}};
constexpr float kTileSize = 1.f / 16.f;
constexpr float kUvInset = 0.0005f;

void faceTileForBlock(std::uint8_t id, int face, int& tx, int& ty) {
    if (id == BlockId::Grass) {
        if (face == 2) { blockTileCoords(BlockId::Grass, tx, ty); return; }
        if (face == 3) { blockTileCoords(BlockId::Dirt, tx, ty); return; }
        grassSideTile(tx, ty); return;
    }
    blockTileCoords(id, tx, ty);
}

bool opaque(const WorldBlockQuery& q, int x, int y, int z) {
    return isOpaqueForAO(q(x, y, z));
}

// Returns AO in 0..3 (3 = brightest)
int vertexAO(bool side1, bool side2, bool corner) {
    if (side1 && side2) return 0;
    return 3 - (static_cast<int>(side1) + static_cast<int>(side2) + static_cast<int>(corner));
}

float aoFactor(int ao) {
    // Dark corners
    static const float table[4] = {0.45f, 0.6f, 0.8f, 1.0f};
    return table[ao & 3];
}

bool shouldEmitFace(const Block& self, const Block& neighbor) {
    if (self.id == BlockId::Water) {
        if (neighbor.id == BlockId::Water) return false;
        return !isSolid(neighbor); // water face against air / non-solid
    }
    // Solids: emit against non-solids (air, water, dust…)
    return !isSolid(neighbor);
}

void emitFace(ChunkMesh& mesh, int bx, int by, int bz, int face, std::uint8_t blockId,
              const WorldBlockQuery& query, int originX, int originZ)
{
    int tileX = 0, tileY = 0;
    faceTileForBlock(blockId, face, tileX, tileY);
    const float u0 = (tileX + kUvInset) * kTileSize;
    const float u1 = (tileX + 1 - kUvInset) * kTileSize;
    const float v0 = 1.f - (tileY + 1 - kUvInset) * kTileSize;
    const float v1 = 1.f - (tileY + kUvInset) * kTileSize;

    const int wx = originX + bx;
    const int wz = originZ + bz;
    // Sample AO on the outside of the face (neighbor cell corner)
    const int nx0 = wx + kFaceNormals[face][0];
    const int ny0 = by + kFaceNormals[face][1];
    const int nz0 = wz + kFaceNormals[face][2];

    float aos[4];
    for (int i = 0; i < 4; ++i) {
        const int* s1 = kAOOffsets[face][i][0];
        const int* s2 = kAOOffsets[face][i][1];
        const int* cr = kAOOffsets[face][i][2];
        const bool side1 = opaque(query, nx0 + s1[0], ny0 + s1[1], nz0 + s1[2]);
        const bool side2 = opaque(query, nx0 + s2[0], ny0 + s2[1], nz0 + s2[2]);
        const bool corn  = opaque(query, nx0 + cr[0], ny0 + cr[1], nz0 + cr[2]);
        aos[i] = aoFactor(vertexAO(side1, side2, corn));
    }

    // Fix anisotropy: flip triangulation if AO[0]+AO[2] != AO[1]+AO[3]
    const bool flip = (aos[0] + aos[2]) > (aos[1] + aos[3]);

    const unsigned base = static_cast<unsigned>(mesh.vertices.size() / 6);
    for (int i = 0; i < 4; ++i) {
        mesh.vertices.push_back(float(bx) + kFaceVerts[face][i][0]);
        mesh.vertices.push_back(float(by) + kFaceVerts[face][i][1]);
        mesh.vertices.push_back(float(bz) + kFaceVerts[face][i][2]);
        mesh.vertices.push_back(u0 + (u1 - u0) * kFaceCornerUV[i][0]);
        mesh.vertices.push_back(v0 + (v1 - v0) * kFaceCornerUV[i][1]);
        mesh.vertices.push_back(aos[i]);
    }
    if (!flip) {
        mesh.indices.insert(mesh.indices.end(), {base, base+1, base+2, base, base+2, base+3});
    } else {
        mesh.indices.insert(mesh.indices.end(), {base+1, base+2, base+3, base+1, base+3, base});
    }
}

} // namespace

void buildChunkMesh(const Chunk& chunk, ChunkMesh& outMesh, const WorldBlockQuery& query)
{
    outMesh.clear();
    outMesh.vertices.reserve(96 * 1024);
    outMesh.indices.reserve(72 * 1024);
    const int originX = chunk.chunkX() * Chunk::SIZE_X;
    const int originZ = chunk.chunkZ() * Chunk::SIZE_Z;

    for (int y = 0; y < Chunk::SIZE_Y; ++y) {
        for (int z = 0; z < Chunk::SIZE_Z; ++z) {
            for (int x = 0; x < Chunk::SIZE_X; ++x) {
                const Block block = chunk.getBlock(x, y, z);
                if (block.isAir()) continue;
                // Skip pure redstone dust as full cubes? render thin — still cube for simplicity
                const int wx = originX + x;
                const int wz = originZ + z;
                for (int face = 0; face < 6; ++face) {
                    const Block neighbor = query(
                        wx + kFaceNormals[face][0],
                        y + kFaceNormals[face][1],
                        wz + kFaceNormals[face][2]);
                    if (!shouldEmitFace(block, neighbor)) continue;
                    emitFace(outMesh, x, y, z, face, block.id, query, originX, originZ);
                }
            }
        }
    }
}

void buildChunkMesh(const Chunk& chunk, ChunkMesh& outMesh)
{
    const int ox = chunk.chunkX() * Chunk::SIZE_X;
    const int oz = chunk.chunkZ() * Chunk::SIZE_Z;
    buildChunkMesh(chunk, outMesh, [&](int wx, int wy, int wz) {
        return chunk.getBlockOrAir(wx - ox, wy, wz - oz);
    });
}

} // namespace mc2
