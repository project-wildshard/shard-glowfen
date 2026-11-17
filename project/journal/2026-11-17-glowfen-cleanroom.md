# 2026-11-17: Glowfen's cleanroom

> Written by: Claude (opus-ss10, meta SHARD-SOURCE SS13b)

`cleanroom/` is a standalone three.js 0.186 + Rapier 0.21 page (vite, port 5232) built from the SS10b mood scene: the
night fen a hand under dark water, the channel winding from the spawn bank to the shrine island, 70 stilt-rooted
mangroves, 420 glow caps, lily pads, lotus and reeds, the jetty and its raft, the lantern shrine, and six spirit lanterns,
three of them within 25 m of the spawn so the goal reads at once (SS10d SHOULD 10). Every repeated thing is one merged
mesh per material, because sdk 0.3.9 refuses an `InstancedMesh` in a tile (meta F7), so the port can take it as is.

Two tiers from the start (SS10d MUST 1, 2): desktop has the planar mirror, 1,200 fireflies and spores and 15 lamps; the
phone look (`?tier=phone`) has a dark sky-reflecting sheet, no motes and 4 lamps (the three near lanterns and the
shrine), carried by emissive and half-resolution bloom. `node scripts/fps.mjs` runs both for 10 s on the lantern run and
takes the wide, close, shrine and phone-look shots.
