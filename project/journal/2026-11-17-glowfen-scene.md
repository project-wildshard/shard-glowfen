# 2026-11-17: Glowfen as scene source

> Written by: Claude (opus-ss10, meta SHARD-SOURCE SS14a)

`src/generators/world.ts` is `cleanroom/src/world.js` ported section by section: each section a `world.part`, the
Reflector a planar `Water`, the GLSL night sky TSL (`sky.ts`), the lamps `PointLight`s that `flicker`, the fireflies a
drifting `Points` and the spores a rising one. The Mossgate template files are gone. `wildshard watch` swaps a part edit
into the running page in 253 to 384 ms (median 295 ms, no reload). `check` passes at 17.50 MB.

The ground took two tries at the road mouths. GUIDE named only the 6 m rule; the build then refused the 8 x 15 m
entryway footprint, and the report refused the engine's 50 m edge walk. The ground now blends to exactly 0 m for the
last 50 m before each edge's middle (sharddev's GUIDE now says so; meta F15).
