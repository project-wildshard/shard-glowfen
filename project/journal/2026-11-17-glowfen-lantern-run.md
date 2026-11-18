# 2026-11-17: Glowfen's lantern run

> Written by: Claude (opus-ss10, meta SHARD-SOURCE SS14b)

"Light the shrine" is a quest added through `defineShard`'s `extend` (`src/generators/lanterns.ts`). Each of the six
spirit lanterns is a region trigger (6 m) that files its flag when a player reaches it; the shrine's trigger needs all
six (`when`) and lights the shrine, which files `glowfen.lit` with 20 coins. The gather step counts the six and marks
each lantern until it is gathered.

The far lanterns moved in (to (-30, 20), (-14, -30) and (28, -8)) so the whole run, about 59 s on foot, fits the proof
tape's 4,096 ticks, and the trees keep 6 m off the lantern trail between them. `scripts/lantern-tape.mjs` writes
`src/proof.json`; `check` plays it green. A tape is open loop and prove reports no pose, so the walk's drift was found by
widening one trigger at a time; 6 m covers it. Carrying a lantern, the raft and a shrine several players fill together
are meta rows.

## The lanterns are pickups (SS-GF1a1b, opus-ss10k)

Each spirit lantern is now a `world.pickup` on its post: E takes it into the kit, lit (ten minutes of fuel, any stand
refills it), and files its `glowfen.lantern.N` flag, so the shrine's trigger still waits on all six. The tape presses E
at each post. The repo moved to sdk and cli 0.4.3 (SDK-SPLIT SP13) and overrides `@wildshard/engine` to 0.1.39, the
first npm engine whose author proof takes a pickup through the kit (engine `d1fc764e`); hero recaptured on that client.
