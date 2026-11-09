#pragma once

namespace mc2 {

class World;

// Infinite-ish water level: meta 0 = source, 1-7 = flowing (higher = shallower).
// Tick water physics in a radius around the player (performance).
void tickWater(World& world, int centerX, int centerZ, int radiusChunks = 2);

} // namespace mc2
