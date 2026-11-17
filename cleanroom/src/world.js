// Glowfen's world, as plain three.js: a bioluminescent mangrove fen at night. Shallow channels of dark water, stilt-rooted
// mangroves, glowing caps, lily pads, a jetty with a raft by the spawn, the lantern shrine on its island and the spirit
// lanterns to carry there. Each section builds into a `part` (a Group) so the shard source (src/generators/world.ts) takes
// it section by section as a `world.part`. Everything repeated is merged into one mesh per material (sdk 0.3.9 refuses
// an InstancedMesh in a tile, meta SHARD-SOURCE F7). `solid(o)` marks what players collide with.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Seeded randomness: each section owns its stream, so editing one never moves another. */
export function stream(seed) {
  let s = seed % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The cell: 500 m square, x and z from -250 to 250. The spawn bank is south (+z), the shrine island north (-z). */
export const MOON_DIRECTION = new THREE.Vector3(-0.4, 0.35, -1).normalize();
export const SPAWN = { x: 0, z: 70, yaw: 0 };
export const SHRINE = { x: 0, z: -70 };
export const WATER_LEVEL = 0.05;
export const WATER_RADIUS = 196;
/** The spirit lanterns: three within 25 m of the spawn so the goal reads at once (SS10d SHOULD 10), three out in the fen. */
export const LANTERNS = [
  { x: -8, z: 58 }, { x: 9, z: 55 }, { x: 2, z: 47 },
  { x: -46, z: 12 }, { x: 42, z: -14 }, { x: -22, z: -42 },
];
/** The main channel's centre line: it winds from the spawn bank to the shrine island. */
export const channelX = (z) => Math.sin(z * 0.025) * 12;

/** The fen floor: hummocks just above and below the water, the channel cut down, flat banks at the spawn and the shrine,
 *  a rim of dry ground past 170 m, cut to 0 m where the four entry roads come in. */
export function groundHeight(x, z) {
  let h = (fbm(x * 0.03, z * 0.03, 4) - 0.5) * 3.4 - 0.3; // mostly a hand below the water, hummocks where the noise is high
  const d = Math.abs(x - channelX(z));
  h = lerp(-0.55, h, smooth(3, 9, d));
  for (const [cx, cz, r, top] of [[SPAWN.x, SPAWN.z + 4, 8, 0.3], [SHRINE.x, SHRINE.z, 12, 0.6]]) {
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
export function groundColour(x, z) {
  const y = groundHeight(x, z);
  const mud = new THREE.Color('#0f1813').lerp(new THREE.Color('#1a2a1e'), fbm(x * 0.05, z * 0.05, 3));
  const moss = new THREE.Color('#1d3a26').lerp(new THREE.Color('#2e5a33'), fbm(x * 0.08 + 4, z * 0.08, 2));
  const c = mud.lerp(moss, smooth(0.0, 0.6, y));
  return [c.r, c.g, c.b];
}

export function materials() {
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
    player: new THREE.MeshStandardMaterial({ color: '#c96f4a', roughness: 0.7 }),
  };
}
const merged = (geos) => mergeGeometries(geos.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (n.attributes.uv) n.deleteAttribute('uv'); return n; }));

/** Where the mangroves stand: off the channel, off the banks, off every lantern's ground. */
export function mangroveSpots() {
  const rand = stream(7), spots = [];
  for (let i = 0; i < 600 && spots.length < 70; i++) {
    const x = lerp(-150, 150, rand()), z = lerp(-150, 150, rand());
    if (Math.hypot(x, z) > 165 || Math.abs(x - channelX(z)) < 10) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 18 || Math.hypot(x - SHRINE.x, z - SHRINE.z) < 20) continue;
    if (LANTERNS.some((l) => Math.hypot(x - l.x, z - l.z) < 9)) continue;
    if (spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 7)) continue;
    spots.push([x, z, 0.8 + rand() * 0.8]);
  }
  return spots;
}

/** Mangroves: arched stilt roots, a leaning trunk, a dark canopy. Two merged meshes; each trunk is solid. */
export function mangroves(part, M, solid) {
  const rand = stream(13), bark = [], leaf = [];
  for (const [x, z, s] of mangroveSpots()) {
    const top = new THREE.Vector3(lerp(-0.6, 0.6, rand()), 3.2, lerp(-0.6, 0.6, rand()));
    const place = (g) => g.scale(s, s, s).translate(x, groundHeight(x, z) - 0.1, z);
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
  for (const [geos, mat] of [[bark, M.bark], [leaf, M.leaf]]) {
    const mesh = new THREE.Mesh(merged(geos), mat); mesh.castShadow = true; mesh.receiveShadow = true; part.add(mesh);
  }
}

/** Glow caps at the mangrove feet, cyan and magenta, one merged mesh per colour. */
export function caps(part, M) {
  const rand = stream(19), spots = mangroveSpots(), byMat = [[M.capCyan, []], [M.capPink, []]];
  for (let i = 0; i < 420; i++) {
    const [sx, sz] = spots[Math.floor(rand() * spots.length)];
    const a = rand() * Math.PI * 2, r = 1 + rand() * 3, s = 0.5 + rand() * 1.4;
    const x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
    const g = new THREE.SphereGeometry(0.22, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(s, s * 0.7, s);
    g.translate(x, Math.max(WATER_LEVEL, groundHeight(x, z)) + rand() * 0.7, z);
    byMat[i % 3 === 0 ? 1 : 0][1].push(g);
  }
  for (const [mat, geos] of byMat) part.add(new THREE.Mesh(merged(geos), mat));
}

/** The fen's lamps: glow points among the caps, the desktop's pool (up to 16 with the lanterns); a phone keeps 4. */
export const GLOWS = (() => {
  const spots = mangroveSpots().filter(([x, z]) => Math.hypot(x - SPAWN.x, z - SPAWN.z) < 90).slice(0, 8);
  return spots.map(([x, z], i) => ({ x: x + 1.5, y: 0.8, z: z + 1, colour: i % 3 ? '#3ff2e0' : '#ff4fd8' }));
})();

/** Lily pads and lotus glow along the channel; reeds on the banks. */
export function pads(part, M) {
  const rand = stream(29), pad = [], lotus = [], reed = [];
  for (let i = 0; i < 220; i++) {
    const z = lerp(-60, 62, rand()), x = channelX(z) + lerp(-6, 6, rand()), s = 0.5 + rand() * 0.9;
    pad.push(new THREE.CircleGeometry(0.6, 10, 0.3, Math.PI * 1.85).rotateX(-Math.PI / 2).rotateY(rand() * 6).scale(s, 1, s).translate(x, WATER_LEVEL + 0.03, z));
    if (i % 9 === 0) lotus.push(new THREE.ConeGeometry(0.16, 0.22, 6, 1, true).translate(x, WATER_LEVEL + 0.14, z));
  }
  for (let i = 0; i < 260; i++) {
    const z = lerp(-80, 80, rand()), side = rand() < 0.5 ? -1 : 1, x = channelX(z) + side * lerp(7, 11, rand());
    const h = 0.8 + rand() * 1.2, g = new THREE.PlaneGeometry(0.08, h).translate(0, h / 2, 0).rotateZ((rand() - 0.5) * 0.4).rotateY(rand() * 3);
    reed.push(g.translate(x, Math.max(WATER_LEVEL, groundHeight(x, z)) - 0.05, z));
  }
  for (const [geos, mat] of [[pad, M.pad], [lotus, M.lotus], [reed, M.reed]]) part.add(new THREE.Mesh(merged(geos), mat));
}

/** The jetty by the spawn and the raft tied to it (the raft that moves is engine work: meta SHARD-SOURCE rows). */
export function jetty(part, M, solid) {
  const planks = [];
  for (let i = 0; i < 12; i++) planks.push(new THREE.BoxGeometry(2.2, 0.08, 0.32).translate(5.5, 0.55, 70 - i * 0.36));
  for (const [x, z] of [[4.5, 70], [6.5, 70], [4.5, 66.2], [6.5, 66.2]]) planks.push(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 6).translate(x, 0, z));
  const raft = [];
  for (let i = 0; i < 6; i++) raft.push(new THREE.CylinderGeometry(0.16, 0.16, 3.2, 8).rotateZ(Math.PI / 2).translate(0, 0.1, (i - 2.5) * 0.33));
  const raftGeo = merged(raft).rotateY(0.25).translate(8.6, WATER_LEVEL + 0.08, 64.5);
  const mesh = new THREE.Mesh(merged([...planks, raftGeo]), M.plank); mesh.castShadow = true; mesh.receiveShadow = true; part.add(mesh);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 4.4), M.plank); deck.position.set(5.5, 0.3, 68); deck.visible = false; part.add(solid(deck));
}

/** The lantern shrine on its island: a stone ring of six sockets around a rune stone with the great lantern bowl. */
export function shrine(part, M, solid) {
  const stone = [], rune = [];
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
}

/** One spirit lantern: a glowing globe in a small cage on a reed float. */
export function lantern(M) {
  const g = new THREE.Group();
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), M.lantern); globe.position.y = 1.3; globe.name = 'globe'; g.add(globe);
  const cage = merged([new THREE.TorusGeometry(0.3, 0.025, 4, 16).translate(0, 1.3, 0), new THREE.TorusGeometry(0.3, 0.025, 4, 16).rotateY(Math.PI / 2).translate(0, 1.3, 0),
    new THREE.CylinderGeometry(0.04, 0.05, 1.1, 6).translate(0, 0.55, 0), new THREE.CylinderGeometry(0.45, 0.5, 0.12, 10).translate(0, 0.02, 0)]);
  g.add(new THREE.Mesh(cage, M.plank));
  return g;
}
