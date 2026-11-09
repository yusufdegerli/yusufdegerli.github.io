#pragma once

namespace mc2 {

class World;

// Redstone dust (BlockId::RedstoneDust) stores power in meta 0..15.
// Redstone torches (BlockId::RedstoneTorch) are power sources (15).
// Power travels through dust up to 15 blocks (decrements by 1 per step).
void tickRedstone(World& world, int centerChunkX, int centerChunkZ, int radiusChunks = 2);

// Falling sand / gravel — if air below, drop one block per tick.
void tickFallingBlocks(World& world, int centerChunkX, int centerChunkZ, int radiusChunks = 2);

} // namespace mc2
