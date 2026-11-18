# 2026-11-17: Glowfen as scene source

> Written by: Claude (opus-ss10, meta SHARD-SOURCE SS14a)

`src/generators/world.ts` is `cleanroom/src/world.js` ported section by section: each section a `world.part`, the
Reflector a planar `Water`, the GLSL night sky TSL (`sky.ts`), the lamps `PointLight`s that `flicker`, the fireflies a
drifting `Points` and the spores a rising one. The Mossgate template files are gone. `wildshard watch` swaps a part edit
into the running page in 253 to 384 ms (median 295 ms, no reload). `check` passes at 17.50 MB.

The ground took two tries at the road mouths. GUIDE named only the 6 m rule; the build then refused the 8 x 15 m
entryway footprint, and the report refused the engine's 50 m edge walk. The ground now blends to exactly 0 m for the
last 50 m before each edge's middle (sharddev's GUIDE now says so; meta F15).

## The raft, the sockets and the shared shrine (opus-ss10j)

On sdk 0.4.0 (`@wildshard/cli` 0.4.0 brings the command; the engine pin goes, and the override names engine 0.1.36 so
`check` proves with the movers and the player fields the fen needs, which 0.1.35 lacks): the raft by the jetty is a mover
part that rides the channel to the shrine island in 45 s while someone stands on it; the shrine's six posts are sockets
whose globe glows for the player who set a lantern on it; and the shrine takes an offer from anyone, up to six, after which
its flame burns for everyone. The hero was recaptured on the v0.1.37 dev client. Carrying a lantern (`world.pickup`)
waits: the author proof ran a tape's E on a pickup through the script scene only, so the take never raised its flag (engine
fix SHARD-SOURCE SS-GF1a1c), and the lanterns stay gathered by walking up to them until an engine release carries it.
