// Glowfen, as three.js source: the cleanroom's cleanroom/src/world.js and the light of its main.js, ported section by
// section (SHARD-SOURCE SS14a). The geometry, materials and lights are the cleanroom's own lines. What changed: each
// section is a `world.part`; the water's Reflector is a `Water`; the sky's GLSL dome is TSL (`sky.ts`); the lantern bob
// and lamp waver are `animate(..., flicker(...))`; the fireflies and spores are `Points` that drift and rise. The phone
// tier is the engine's: it drops the planar mirror and the motes and keeps the nearest 4 lamps by itself.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { animate, drift, flicker, rise, solid, Water, type ShardWorld } from '@wildshard/sdk/scene/author';
import { MOON_DIRECTION, nightSky } from './sky';

/** Seeded randomness: each section owns its stream, so editing one never moves another. */
export function stream(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function hash(x: number, z: number): number { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, z: number, oct = 4): number { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The cell: 500 m square, x and z from -250 to 250. The spawn bank is south (+z), the shrine island north (-z). */
export const SPAWN = { x: 0, z: 70, yaw: 0 };
export const SHRINE = { x: 0, z: -70 };
export const WATER_LEVEL = 0.05;
export const WATER_RADIUS = 196;
export interface Spot { readonly x: number; readonly z: number }
/** SS-GF1a1b: the lantern every stand hands over: carried lit through the fen for ten minutes, refilled at any stand. */
export const SPIRIT_LANTERN = { id: 'tool.spirit-lantern', name: 'Spirit lantern', blurb: 'A spirit lantern from the fen; any stand refills it.', colour: '#ffb347', intensity: 3, fuelSeconds: 600 } as const;
/** The spirit lanterns: three within 25 m of the spawn so the goal reads at once (SS10d SHOULD 10), three out in the fen. */
export const LANTERNS: readonly Spot[] = [
  { x: -8, z: 58 }, { x: 9, z: 55 }, { x: 2, z: 47 },
  { x: -30, z: 20 }, { x: -14, z: -30 }, { x: 28, z: -8 },
];
/** The lantern trail: the shortest walk from the spawn past every lantern to the shrine, kept clear of trees. */
export const TRAIL: readonly Spot[] = [SPAWN, LANTERNS[1], LANTERNS[2], LANTERNS[0], LANTERNS[3], LANTERNS[4], LANTERNS[5], SHRINE].filter((s): s is Spot => s !== undefined);
const segDist = (x: number, z: number, a: Spot, b: Spot): number => {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
};
/** The main channel's centre line: it winds from the spawn bank to the shrine island. */
export const channelX = (z: number): number => Math.sin(z * 0.025) * 12;

/** The fen floor: mostly a hand below the water, hummocks where the noise is high, the channel cut down, flat banks at
 *  the spawn and the shrine, a rim of dry ground past 170 m, cut to 0 m where the four entry roads come in. */
export function groundHeight(x: number, z: number): number {
  let h = (fbm(x * 0.03, z * 0.03, 4) - 0.5) * 3.4 - 0.3;
  const d = Math.abs(x - channelX(z));
  h = lerp(-0.55, h, smooth(3, 9, d));
  for (const [cx, cz, r, top] of [[SPAWN.x, SPAWN.z + 4, 8, 0.3], [SHRINE.x, SHRINE.z, 12, 0.6]] as const) {
    const k = 1 - smooth(r * 0.7, r, Math.hypot(x - cx, z - cz));
    h = lerp(h, top, k);
  }
  const r = Math.hypot(x, z);
  const pass = smooth(10, 30, Math.min(Math.abs(x), Math.abs(z)));
  const rim = smooth(170, 228, r) * pass * (2.5 + fbm(x * 0.02 + 9, z * 0.02, 3) * 7);
  // the road mouths: exactly 0 m for the first 50 m in from each edge, 8 m wide and a lattice cell round it (the engine walks each entry 50 m)
  h = lerp(h, 0, smooth(186, 197, r) * (1 - smooth(9, 18, Math.min(Math.abs(x), Math.abs(z)))));
  return h + rim;
}
/** Wet black mud below the water, moss green on the hummocks and the rim. */
export function groundColour(x: number, z: number): [number, number, number] {
  const y = groundHeight(x, z);
  const mud = new THREE.Color('#0f1813').lerp(new THREE.Color('#1a2a1e'), fbm(x * 0.05, z * 0.05, 3));
  const moss = new THREE.Color('#1d3a26').lerp(new THREE.Color('#2e5a33'), fbm(x * 0.08 + 4, z * 0.08, 2));
  const c = mud.lerp(moss, smooth(0.0, 0.6, y));
  return [c.r, c.g, c.b];
}

function materials() {
  return {
    bark: new THREE.MeshStandardMaterial({ color: '#2b2219', roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#1f3d2a', roughness: 0.85, flatShading: true }),
    capCyan: new THREE.MeshStandardMaterial({ color: '#3ff2e0', emissive: '#3ff2e0', emissiveIntensity: 2.2, roughness: 0.5 }),
    capPink: new THREE.MeshStandardMaterial({ color: '#ff4fd8', emissive: '#ff4fd8', emissiveIntensity: 2.2, roughness: 0.5 }),
    pad: new THREE.MeshStandardMaterial({ color: '#2f6b3a', roughness: 0.6, side: THREE.DoubleSide }),
    lotus: new THREE.MeshStandardMaterial({ color: '#ffe9f6', emissive: '#ff9ad8', emissiveIntensity: 1.4, roughness: 0.5 }),
    plank: new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 0.85 }),
    stone: new THREE.MeshStandardMaterial({ color: '#4d5a63', roughness: 0.9, flatShading: true }),
    rune: new THREE.MeshStandardMaterial({ color: '#7fe8ff', emissive: '#5fd8ff', emissiveIntensity: 1.6, roughness: 0.4 }),
    lantern: new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ffb347', emissiveIntensity: 4, roughness: 0.4 }),
    reed: new THREE.MeshStandardMaterial({ color: '#2c4a2a', roughness: 0.8, side: THREE.DoubleSide }),
  };
}
type Materials = ReturnType<typeof materials>;
const merged = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry => mergeGeometries(geos.map((g) => {
  const n = g.index ? g.toNonIndexed() : g; if (n.hasAttribute('uv')) n.deleteAttribute('uv'); return n;
}));

/** Where the mangroves stand: off the channel, off the banks, off every lantern's ground. */
export function mangroveSpots(): [number, number, number][] {
  const rand = stream(7), spots: [number, number, number][] = [];
  for (let i = 0; i < 600 && spots.length < 70; i++) {
    const x = lerp(-150, 150, rand()), z = lerp(-150, 150, rand());
    if (Math.hypot(x, z) > 165 || Math.abs(x - channelX(z)) < 10) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 18 || Math.hypot(x - SHRINE.x, z - SHRINE.z) < 20) continue;
    if (LANTERNS.some((l) => Math.hypot(x - l.x, z - l.z) < 9)) continue;
    if (TRAIL.slice(1).some((b, k) => segDist(x, z, TRAIL[k] ?? b, b) < 6)) continue;
    if (spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 7)) continue;
    spots.push([x, z, 0.8 + rand() * 0.8]);
  }
  return spots;
}

/** Mangroves: arched stilt roots, a leaning trunk, a dark canopy. Two merged meshes; each trunk a collider. */
export function mangroves(part: THREE.Group, M: Materials): void {
  const rand = stream(13), bark: THREE.BufferGeometry[] = [], leaf: THREE.BufferGeometry[] = [];
  for (const [x, z, s] of mangroveSpots()) {
    const top = new THREE.Vector3(lerp(-0.6, 0.6, rand()), 3.2, lerp(-0.6, 0.6, rand()));
    const place = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.scale(s, s, s).translate(x, groundHeight(x, z) - 0.1, z);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand() * 0.5, r = 1.6 + rand() * 1.2;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * r, -0.4, Math.sin(a) * r), new THREE.Vector3(Math.cos(a) * r * 0.7, 1.4, Math.sin(a) * r * 0.7), new THREE.Vector3(Math.cos(a) * 0.3, 2.4, Math.sin(a) * 0.3), top]);
      bark.push(place(new THREE.TubeGeometry(curve, 8, 0.09, 4)));
    }
    const trunk = new THREE.CatmullRomCurve3([top, top.clone().add(new THREE.Vector3(0.4, 2.5, 0.2)), top.clone().add(new THREE.Vector3(-0.2, 5, 0))]);
    bark.push(place(new THREE.TubeGeometry(trunk, 6, 0.28, 6)));
    for (let i = 0; i < 5; i++) {
      const b = new THREE.IcosahedronGeometry(1.6 + rand() * 1.2, 1); b.scale(1, 0.6, 1);
      b.translate(top.x + lerp(-2.6, 2.6, rand()), 5 + rand() * 1.6, top.z + lerp(-2.6, 2.6, rand()));
      leaf.push(place(b));
    }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * s, 1.2 * s, 3, 8), M.bark);
    post.position.set(x, 1.5, z); post.visible = false; part.add(solid(post));
  }
  for (const [geos, mat] of [[bark, M.bark], [leaf, M.leaf]] as const) {
    const mesh = new THREE.Mesh(merged(geos), mat); mesh.castShadow = true; mesh.receiveShadow = true; part.add(mesh);
  }
}

/** Glow caps at the mangrove feet, cyan and magenta, one merged mesh per colour. */
export function caps(part: THREE.Group, M: Materials): void {
  const rand = stream(19), spots = mangroveSpots(), cyan: THREE.BufferGeometry[] = [], pink: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 420; i++) {
    const [sx, sz] = spots[Math.floor(rand() * spots.length)] ?? [0, 0];
    const a = rand() * Math.PI * 2, r = 1 + rand() * 3, s = 0.5 + rand() * 1.4;
    const x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
    const g = new THREE.SphereGeometry(0.22, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(s, s * 0.7, s);
    g.translate(x, Math.max(WATER_LEVEL, groundHeight(x, z)) + rand() * 0.7, z);
    (i % 3 === 0 ? pink : cyan).push(g);
  }
  part.add(new THREE.Mesh(merged(cyan), M.capCyan), new THREE.Mesh(merged(pink), M.capPink));
}

/** The fen's lamps among the caps (the desktop's pool is 15 with the lanterns and shrine; a phone keeps the nearest 4). */
export function glows(part: THREE.Group): void {
  const spots = mangroveSpots().filter(([x, z]) => Math.hypot(x - SPAWN.x, z - SPAWN.z) < 90).slice(0, 8);
  spots.forEach(([x, z], i) => {
    const l = new THREE.PointLight(new THREE.Color(i % 3 ? '#3ff2e0' : '#ff4fd8'), 6, 14, 2); l.position.set(x + 1.5, 0.8, z + 1);
    part.add(animate(l, flicker({ rate: 0.6 + i * 0.1, amount: 0.25 })));
  });
}

/** Lily pads and lotus glow along the channel; reeds on the banks. */
export function pads(part: THREE.Group, M: Materials): void {
  const rand = stream(29), pad: THREE.BufferGeometry[] = [], lotus: THREE.BufferGeometry[] = [], reed: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 220; i++) {
    const z = lerp(-60, 62, rand()), x = channelX(z) + lerp(-6, 6, rand()), s = 0.5 + rand() * 0.9;
    pad.push(new THREE.CircleGeometry(0.6, 10, 0.3, Math.PI * 1.85).rotateX(-Math.PI / 2).rotateY(rand() * 6).scale(s, 1, s).translate(x, WATER_LEVEL + 0.03, z));
    if (i % 9 === 0) lotus.push(new THREE.ConeGeometry(0.16, 0.22, 6, 1, true).translate(x, WATER_LEVEL + 0.14, z));
  }
  for (let i = 0; i < 260; i++) {
    const z = lerp(-80, 80, rand()), side = rand() < 0.5 ? -1 : 1, x = channelX(z) + side * lerp(7, 11, rand());
    // a real reed (QA 11-24 row 54, J510): a tapering three-sided stalk, not a flat plane; same draws of the stream
    const h = 0.8 + rand() * 1.2, g = new THREE.ConeGeometry(0.06, h, 3, 1, true).translate(0, h / 2, 0).rotateZ((rand() - 0.5) * 0.4).rotateY(rand() * 3);
    reed.push(g.translate(x, Math.max(WATER_LEVEL, groundHeight(x, z)) - 0.05, z));
  }
  for (const [geos, mat] of [[pad, M.pad], [lotus, M.lotus], [reed, M.reed]] as const) part.add(new THREE.Mesh(merged(geos), mat));
}

/** The jetty by the spawn; the raft tied to it is its own part (`raft`), a mover. */
export function jetty(part: THREE.Group, M: Materials): void {
  const planks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) planks.push(new THREE.BoxGeometry(2.2, 0.08, 0.32).translate(5.5, 0.55, 70 - i * 0.36));
  for (const [x, z] of [[4.5, 70], [6.5, 70], [4.5, 66.2], [6.5, 66.2]] as const) planks.push(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 6).translate(x, 0, z));
  const mesh = new THREE.Mesh(merged(planks), M.plank); mesh.castShadow = true; mesh.receiveShadow = true; part.add(mesh);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 4.4), M.plank); deck.position.set(5.5, 0.3, 68); deck.visible = false; part.add(solid(deck));
}

/** Where the raft is tied, and the channel it rides to the shrine island: points on the channel's centre line. */
const RAFT = { x: 8.6, y: WATER_LEVEL + 0.18, z: 64.5 };
export const RAFT_PATH: readonly (readonly [number, number, number])[] = [50, 30, 10, -10, -30, -54].map((z) => [Math.round(channelX(z) * 100) / 100, RAFT.y, z] as const);

/** The raft by the jetty (SHARD-SOURCE SS-GF2a): six logs and a deck to stand on. Stand on it and it rides the channel
 *  to the shrine island in 45 s; step off and it waits; it comes back the same way. */
export function raft(part: THREE.Group, M: Materials): void {
  const logs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) logs.push(new THREE.CylinderGeometry(0.16, 0.16, 3.2, 8).rotateZ(Math.PI / 2).translate(0, 0.1, (i - 2.5) * 0.33));
  const mesh = new THREE.Mesh(merged(logs).rotateY(0.25).translate(RAFT.x, WATER_LEVEL + 0.08, RAFT.z), M.plank); mesh.castShadow = true; mesh.receiveShadow = true; part.add(mesh);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.32, 2), M.plank); deck.position.set(RAFT.x, WATER_LEVEL + 0.18, RAFT.z); deck.rotation.y = 0.25; deck.visible = false; part.add(solid(deck));
}

/** FORMAT-PRUNE FP49: the shrine's glow, eased from the lantern run's flags: dim until a lantern is gathered, a step brighter
 *  with each, full once the shrine is lit (`world.field`, format `weather.fields`). The shrine's light follows it. */
export const GLOW = 'glowfen.glow';
export function glowField(world: ShardWorld): void {
  const gathered = LANTERNS.map((_, i) => `glowfen.lantern.${String(i + 1)}`);
  world.field(GLOW, { quest: 'glowfen.lit', else: 0.2, rate: 0.15, steps: [
    { when: { all: ['glowfen.lit'] }, value: 1 },
    ...[6, 5, 4, 3, 2, 1].map((n) => ({ when: { count: { of: gathered, atLeast: n } }, value: Math.round((0.2 + n * 0.12) * 100) / 100 })),
  ] });
}

/** The lantern shrine on its island: a stone ring of six sockets around a rune stone with the great lantern bowl. */
export function shrine(part: THREE.Group, M: Materials, world: ShardWorld): void {
  const stone: THREE.BufferGeometry[] = [], rune: THREE.BufferGeometry[] = [];
  stone.push(new THREE.CylinderGeometry(7, 7.6, 0.6, 24).translate(SHRINE.x, 0.55, SHRINE.z));
  stone.push(new THREE.CylinderGeometry(1.2, 1.5, 2.4, 8).translate(SHRINE.x, 2, SHRINE.z));
  stone.push(new THREE.SphereGeometry(1.3, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(SHRINE.x, 3.9, SHRINE.z));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, x = SHRINE.x + Math.cos(a) * 5.4, z = SHRINE.z + Math.sin(a) * 5.4;
    stone.push(new THREE.BoxGeometry(0.7, 2.2, 0.7).translate(x, 1.9, z));
    rune.push(new THREE.TorusGeometry(0.3, 0.06, 6, 16).rotateX(Math.PI / 2).translate(x, 3.05, z));
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.8), M.stone); post.position.set(x, 1.9, z); post.visible = false; part.add(solid(post));
  }
  rune.push(new THREE.TorusGeometry(1.25, 0.07, 6, 32).rotateX(Math.PI / 2).translate(SHRINE.x, 3.95, SHRINE.z));
  const mesh = new THREE.Mesh(merged(stone), M.stone); mesh.castShadow = true; mesh.receiveShadow = true; part.add(mesh);
  part.add(new THREE.Mesh(merged(rune), M.rune));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 2.6, 8), M.stone); core.position.set(SHRINE.x, 2.1, SHRINE.z); core.visible = false; part.add(solid(core));
  // FP49: the shrine's light is the page's own (`world.emitter`, format `light.emitters`): it wakes with the glow, from a
  // fifth of its strength at the start (dimmer than it used to stand) to the platform washed cyan once the shrine is lit
  const light = new THREE.PointLight(new THREE.Color('#7fe8ff'), 70, 30, 2); light.position.set(SHRINE.x, 4.6, SHRINE.z);
  part.add(animate(light, flicker({ rate: 0.4, amount: 0.15 })));
  world.emitter('glowfen.shrine', light, { field: GLOW });
}

/** The spirit lanterns: a glowing globe in a small cage on a reed float, each with its warm lamp. */
/** SS-GF1a1b: each spirit lantern hangs on its post as a pickup: E takes it into the kit, lit, and files its flag. */
export function lanterns(part: THREE.Group, M: Materials, world: ShardWorld): void {
  const globes: THREE.BufferGeometry[] = [], cages: THREE.BufferGeometry[] = [];
  LANTERNS.forEach((l, i) => {
    const y = Math.max(WATER_LEVEL, groundHeight(l.x, l.z));
    globes.push(new THREE.SphereGeometry(0.28, 16, 12).translate(l.x, y + 1.3, l.z));
    cages.push(new THREE.TorusGeometry(0.3, 0.025, 4, 16).translate(l.x, y + 1.3, l.z), new THREE.TorusGeometry(0.3, 0.025, 4, 16).rotateY(Math.PI / 2).translate(l.x, y + 1.3, l.z),
      new THREE.CylinderGeometry(0.04, 0.05, 1.1, 6).translate(l.x, y + 0.55, l.z), new THREE.CylinderGeometry(0.45, 0.5, 0.12, 10).translate(l.x, y + 0.02, l.z));
    const hook = new THREE.Object3D(); hook.position.set(l.x, y + 1.3, l.z); part.add(hook);
    world.pickup(`glowfen.lantern.${String(i + 1)}`, hook, { label: 'Take the spirit lantern', radius: 2.5, item: SPIRIT_LANTERN, flag: `glowfen.lantern.${String(i + 1)}` });
    const lamp = new THREE.PointLight(new THREE.Color('#ffb347'), 8, 12, 2); lamp.position.set(l.x, y + 1.5, l.z);
    part.add(animate(lamp, flicker({ rate: 1 + i * 0.13, amount: 0.12 })));
  });
  part.add(new THREE.Mesh(merged(globes), M.lantern), new THREE.Mesh(merged(cages), M.plank));
}

/** MZ32 (meta MOSSGATE-ZONE, QA 11-19 row 35: "I'm setting these lanterns and nothing happens"): a light laid on the
 *  ground, three soft discs (a panel holds meshes only, so the glow is drawn: MZ34 brings real lamps to panels). */
function glowPool(into: THREE.Group, x: number, y: number, z: number, radius: number, colour: string): void {
  for (const [r, opacity, lift] of [[1, 0.22, 0.02], [0.66, 0.34, 0.03], [0.36, 0.5, 0.04]] as const) {
    const material = new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 1.4, roughness: 1, transparent: true, opacity, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * r, 32), material);
    disc.rotation.x = -Math.PI / 2; disc.position.set(x, y + lift, z); into.add(disc);
  }
}

/**
 * SS-GF1a2: the shrine's six posts are sockets. Setting a spirit lantern on one (its prompt) writes that player's own
 * `glowfen.socket.N`, and the post's globe glows for them alone (a panel shown by that player field, never solid).
 */
export function sockets(world: ShardWorld, M: Materials): void {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, x = SHRINE.x + Math.cos(a) * 5.4, z = SHRINE.z + Math.sin(a) * 5.4, id = `glowfen.socket.${String(i + 1)}`;
    world.part(`socket-${String(i + 1)}`, (part) => {
      const at = new THREE.Object3D(); at.position.set(x, 1.6, z); part.add(at);
      world.interact(id, at, { label: 'Set a spirit lantern', radius: 2.5, sets: { field: id, scope: 'player', value: true } });
    });
    world.part(`socket-${String(i + 1)}-glow`, (part) => {
      part.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), M.lantern).translateX(x).translateY(3.3).translateZ(z));
      // MZ32: a set lantern lights the island round its post, and its light stays
      part.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.22, 2.4, 10), M.lantern).translateX(x).translateY(4.7).translateZ(z));
      // on the shrine's stone platform (its top is 0.85 m), not the fen floor under it
      glowPool(part, x, 0.86, z, 4.5, '#ffc46a');
    }, { panel: `${id}.glow`, shownWhen: { field: id, equals: true } });
  }
}

/**
 * SS-GF2b: the one shrine every player fills together. Each offer adds a light to the shared `glowfen.shrine.lights`
 * (up to six, then the prompt is spent), and at six the flame over the dome burns for everyone (a shared panel).
 */
export function shrineFlame(world: ShardWorld, M: Materials): void {
  world.part('shrine-offer', (part) => {
    const at = new THREE.Object3D(); at.position.set(SHRINE.x, 1.6, SHRINE.z + 1.8); part.add(at);
    world.interact('glowfen.shrine.offer', at, { label: 'Offer a spirit light', radius: 2.5, sets: { field: 'glowfen.shrine.lights', scope: 'shared', add: 1, max: 6 } });
  });
  world.part('shrine-flame', (part) => {
    part.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 14), M.lantern).translateX(SHRINE.x).translateY(5.4).translateZ(SHRINE.z));
    // MZ32, the finale: the full shrine lights the fen. A pillar of light over the dome, the island ringed in light, and every
    // lantern's post and the trail back to the jetty glowing, so the whole run you walked is lit behind you.
    part.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.1, 26, 16, 1, true), M.lantern).translateX(SHRINE.x).translateY(19).translateZ(SHRINE.z));
    glowPool(part, SHRINE.x, 0.86, SHRINE.z, 13, '#8ff0ff');
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, x = SHRINE.x + Math.cos(a) * 9.5, z = SHRINE.z + Math.sin(a) * 9.5;
      part.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), M.lantern).translateX(x).translateY(Math.max(WATER_LEVEL, groundHeight(x, z)) + 0.5).translateZ(z));
    }
    for (const l of LANTERNS) glowPool(part, l.x, Math.max(WATER_LEVEL, groundHeight(l.x, l.z)), l.z, 7, '#ffc46a');
    for (let leg = 0; leg < TRAIL.length - 1; leg++) {
      const a = TRAIL[leg], b = TRAIL[leg + 1]; if (a === undefined || b === undefined) continue;
      const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 6));
      for (let k = 1; k < n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
        glowPool(part, x, Math.max(WATER_LEVEL, groundHeight(x, z)), z, 2.4, '#9ff4c8');
      }
    }
  }, { panel: 'glowfen.shrine.flame', shownWhen: { field: 'glowfen.shrine.lights', equals: 6 } });
}

/** Fireflies over the channel and spores rising out of the canopy (the engine leaves both off on a phone). */
export function motes(part: THREE.Group): void {
  const clouds = [[900, [-40, 0.3, -90, 40, 6, 80], '#c6ff6a', 0.22, 0.9, 61, 'drift'], [300, [-60, 2, -120, 60, 18, 60], '#6af0ff', 0.3, 0.5, 67, 'rise']] as const;
  for (const [count, box, colour, size, opacity, seed, motion] of clouds) {
    const rand = stream(seed), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) pos.set([lerp(box[0], box[3], rand()), lerp(box[1], box[4], rand()), lerp(box[2], box[5], rand())], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cloud = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(colour), size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    part.add(animate(cloud, motion === 'drift' ? drift({ rate: 0.3, radius: 0.8 }) : rise({ rate: 0.1, height: 3, spread: 1 })));
  }
}

/** The water: one circle over the fen, the planar mirror with its dark teal tint. */
export function water(part: THREE.Group): void {
  const shape = new THREE.Shape(); shape.absarc(0, 0, WATER_RADIUS, 0, Math.PI * 2, false);
  const w = new Water(shape, { tint: '#2a5f66', reflect: 'planar', segments: 96 });
  w.position.y = WATER_LEVEL;
  part.add(w);
}

/** The night light (cleanroom main.js): the sky, the cold fill, the moon with shadows, the fog, the composer. */
export function night(world: ShardWorld): void {
  world.sky(nightSky(), { environment: { intensity: 0.35, ground: [0.04, 0.1, 0.08] } });
  world.scene.fog = new THREE.FogExp2(new THREE.Color('#14243a'), 0.02);
  world.part('light', (part) => {
    part.add(new THREE.HemisphereLight(new THREE.Color('#4a6fa8'), new THREE.Color('#0b1a14'), 0.55));
    const moon = new THREE.DirectionalLight(new THREE.Color('#a9c2ff'), 0.55);
    moon.position.copy(MOON_DIRECTION).multiplyScalar(150).setY(120); moon.castShadow = true;
    part.add(moon, moon.target);
  });
  world.post({ tone: 'aces', exposure: 1.15, bloom: { strength: 0.9, radius: 0.55, threshold: 0.55 } });
}

/** Glowfen: the light, the ground and every section of the cleanroom, one part each. */
export function buildGlowfen(world: ShardWorld): void {
  const M = materials();
  night(world);
  world.ground(groundHeight, { colourAt: groundColour, material: new THREE.MeshStandardMaterial({ roughness: 0.95 }) });
  world.part('water', (part) => { water(part); });
  world.part('mangroves', (part) => { mangroves(part, M); });
  world.part('caps', (part) => { caps(part, M); });
  world.part('glows', (part) => { glows(part); });
  world.part('pads', (part) => { pads(part, M); });
  world.part('jetty', (part) => { jetty(part, M); });
  world.part('raft', (part) => { raft(part, M); }, { panel: 'glowfen.raft', mover: { path: RAFT_PATH, seconds: 45 } });
  glowField(world);
  world.part('shrine', (part) => { shrine(part, M, world); });
  sockets(world, M);
  shrineFlame(world, M);
  world.part('lanterns', (part) => { lanterns(part, M, world); });
  world.part('motes', (part) => { motes(part); });
  world.spawn(SPAWN.x, 1, SPAWN.z, SPAWN.yaw);
}
