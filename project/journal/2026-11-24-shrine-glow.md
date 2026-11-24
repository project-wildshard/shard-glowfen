# 2026-11-24: the shrine wakes with the lantern run (FORMAT-PRUNE FP49)

> Written by: Claude (opus-fp49)

The shrine's light stood at full strength from the first second, so the lantern run changed nothing you could see until
the finale. Now a `glow` field eases from the run's flags (`world.field`: a fifth at the start, a step with each lantern
gathered, full once the shrine is lit), and the shrine's light is the page's own (`world.emitter`) following it, from
about a fifth of its strength to brighter than it stood before. It makes Glowfen the second user of the engine's
`weather.fields` and `light.emitters` (FP49's single-shard counter). Needs SDK `world.field` and `world.emitter` (sharddev
73b9d5a2), format 0.78.0 and the engine half (engine 6d85e2543).
