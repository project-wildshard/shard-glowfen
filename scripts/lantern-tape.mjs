// Write src/proof.json, the lantern run on foot (SHARD-SOURCE SS14b): straight along the lantern trail from the spawn past
// every lantern to the shrine, the stick pointing along the world line (a tape's stick is world space; yaw only turns the
// body), at the walk speed in m/s. The tape stands still for 40 ticks at the third lantern and checkpoints there (a body
// moving at the checkpoint makes the restore diverge). The trail copies src/generators/world.ts (TRAIL); `wildshard check`
// plays the tape, so a drift fails there.
// Usage: node scripts/lantern-tape.mjs [speed 4.4] [out src/proof.json]
import { writeFileSync } from 'node:fs';
const v = Number(process.argv[2] ?? 4.4);
const trail = [{ x: 0, z: 70 }, { x: 9, z: 55 }, { x: 2, z: 47 }, { x: -8, z: 58 }, { x: -30, z: 20 }, { x: -14, z: -30 }, { x: 28, z: -8 }, { x: 0, z: -70 }];
const tape = [];
let rest = 1;
for (let i = 1; i < trail.length; i++) {
  const a = trail[i - 1], b = trail[i], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  const mx = Math.round((dx / d) * 1000) / 1000, mz = Math.round((dz / d) * 1000) / 1000, yaw = Math.round(Math.atan2(-dx, -dz) * 1000) / 1000;
  for (let t = 0; t < Math.ceil((d / v) * 60); t++) tape.push([{ kind: 'player', moveX: mx, moveZ: mz, yaw }]);
  if (i === 3) { for (let t = 0; t < 40; t++) tape.push([{ kind: 'player', moveX: 0, moveZ: 0, yaw }]); rest = tape.length - 5; }
}
tape.push([{ kind: 'player', moveX: 0, moveZ: 0, yaw: 0 }]);
writeFileSync(process.argv[3] ?? 'src/proof.json', JSON.stringify({ version: 1, tape, checkpointTick: rest, requiredFacts: ['glowfen.lit'] }) + '\n');
console.log(tape.length, 'ticks');
