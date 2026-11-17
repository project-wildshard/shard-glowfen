// Glowfen cleanroom: the renderer, the night sky and moon, the fen floor and its water, Rapier and a walking player.
// ?tier=phone is the phone look (SS10d MUST 1, 2): no planar mirror (a dark sky-reflecting sheet), no fireflies or spores,
// at most 4 lamps, carried by emissive and bloom. ?cam=x,y,z,lx,ly,lz fixes the camera; ?auto=1 walks the lantern run;
// window.__fps holds the 60-capped frame rate and window.__stats the triangles, draws and lamps.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as W from './world.js';

const q = new URLSearchParams(location.search);
const phone = q.get('tier') === 'phone';
await RAPIER.init();

const renderer = new THREE.WebGLRenderer({ antialias: !phone });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#14243a', 0.02);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);

// ---------- sky: ink zenith, a blue band at the horizon, the moon low over the shrine ----------
const SKY = { top: '#050816', mid: '#1b2a4a', bottom: '#0a1220', moon: '#9fb8ff' };
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    top: { value: new THREE.Color(SKY.top) }, mid: { value: new THREE.Color(SKY.mid) }, bottom: { value: new THREE.Color(SKY.bottom) },
    moonDir: { value: W.MOON_DIRECTION }, moonCol: { value: new THREE.Color(SKY.moon) },
  },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
  fragmentShader: `uniform vec3 top, mid, bottom, moonCol, moonDir; varying vec3 vDir;
    void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(mid, top, pow(smoothstep(0.0, 1.0, h), 0.45)) : mix(mid, bottom, smoothstep(0.0, -0.2, h));
      float d = max(dot(normalize(vDir), moonDir), 0.0); c += moonCol * pow(d, 80.0) * 0.25; c += moonCol * smoothstep(0.9993, 0.9995, d) * 1.6;
      gl_FragColor = vec4(c, 1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), skyMat);
sky.renderOrder = -1; scene.add(sky);
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); envScene.add(sky.clone());
scene.environment = pmrem.fromScene(envScene, 0.02).texture;
scene.environmentIntensity = 0.35;

// ---------- light: the moon (shadows) and a cold sky fill ----------
const moon = new THREE.DirectionalLight('#a9c2ff', 0.55);
moon.castShadow = true;
moon.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
Object.assign(moon.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 400 });
moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04;
scene.add(moon, moon.target, new THREE.HemisphereLight('#4a6fa8', '#0b1a14', 0.55));

// ---------- ground: one height mesh over the cell ----------
function groundMesh() {
  const size = 500, seg = 200;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, W.groundHeight(x, z)); col.set(W.groundColour(x, z), i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  m.receiveShadow = true; return m;
}
scene.add(groundMesh());

// ---------- the water: a planar mirror with a teal tint on desktop, a dark sheet that takes the sky on the phone ----------
const waterGeo = new THREE.CircleGeometry(W.WATER_RADIUS, 96); waterGeo.rotateX(-Math.PI / 2);
let water;
if (phone) water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: '#0d2a30', metalness: 0.9, roughness: 0.12, envMapIntensity: 1.6 }));
else water = new Reflector(waterGeo, { textureWidth: 1024, textureHeight: 1024, color: 0x2a5f66 });
water.position.y = W.WATER_LEVEL; scene.add(water);
if (!phone) {
  const film = new THREE.Mesh(waterGeo, new THREE.MeshBasicMaterial({ color: '#03141a', transparent: true, opacity: 0.45, depthWrite: false }));
  film.position.y = W.WATER_LEVEL + 0.02; scene.add(film);
}

// ---------- the world's sections ----------
const M = W.materials();
const solids = [];
const solid = (o) => { solids.push(o); return o; };
for (const [name, build] of Object.entries({
  mangroves: (p) => W.mangroves(p, M, solid),
  caps: (p) => W.caps(p, M),
  pads: (p) => W.pads(p, M),
  jetty: (p) => W.jetty(p, M, solid),
  shrine: (p) => W.shrine(p, M, solid),
})) { const g = new THREE.Group(); g.name = name; build(g); scene.add(g); }

// the spirit lanterns, bobbing on their floats
const lanterns = W.LANTERNS.map((l) => { const g = W.lantern(M); g.position.set(l.x, Math.max(W.WATER_LEVEL, W.groundHeight(l.x, l.z)), l.z); scene.add(g); return g; });

// lamps: the desktop pool is up to 16, the phone keeps 4 (the three near lanterns and the shrine)
const lamps = [
  ...W.LANTERNS.slice(0, 3).map((l) => ({ x: l.x, y: 1.5, z: l.z, colour: '#ffb347', intensity: 8, range: 12 })),
  { x: W.SHRINE.x, y: 4.6, z: W.SHRINE.z, colour: '#7fe8ff', intensity: 18, range: 22 },
  ...(phone ? [] : [...W.LANTERNS.slice(3).map((l) => ({ x: l.x, y: 1.5, z: l.z, colour: '#ffb347', intensity: 8, range: 12 })),
    ...W.GLOWS.map((g) => ({ ...g, intensity: 6, range: 14 }))]),
];
for (const l of lamps) { const p = new THREE.PointLight(l.colour, l.intensity, l.range, 2); p.position.set(l.x, l.y, l.z); scene.add(p); }

// fireflies and drifting spores (desktop only)
const motes = [];
const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, '#fff'); r.addColorStop(0.3, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
if (!phone) {
  for (const [count, box, colour, size, opacity, seed] of [[900, [-40, 0.3, -90, 40, 6, 80], '#c6ff6a', 0.22, 0.9, 61], [300, [-60, 2, -120, 60, 18, 60], '#6af0ff', 0.3, 0.5, 67]]) {
    const rand = W.stream(seed), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) pos.set([W.lerp(box[0], box[3], rand()), W.lerp(box[1], box[4], rand()), W.lerp(box[2], box[5], rand())], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: colour, size, map: dot, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(pts); motes.push(pts);
  }
}

// ---------- physics: the fen floor as a heightfield, trunks, posts and the jetty, a kinematic capsule ----------
const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
{
  const n = 125, size = 500, h = new Float32Array((n + 1) * (n + 1));
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) h[i * (n + 1) + j] = W.groundHeight(-size / 2 + (i / n) * size, -size / 2 + (j / n) * size);
  physics.createCollider(RAPIER.ColliderDesc.heightfield(n, n, h, { x: size, y: 1, z: size }));
}
for (const o of solids) {
  const p = o.geometry.parameters;
  const desc = p.radiusTop !== undefined ? RAPIER.ColliderDesc.cylinder(p.height / 2, p.radiusTop) : RAPIER.ColliderDesc.cuboid(p.width / 2, p.height / 2, p.depth / 2);
  physics.createCollider(desc.setTranslation(o.position.x, o.position.y, o.position.z));
}
const body = physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(W.SPAWN.x, 1.2, W.SPAWN.z));
const capsule = physics.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.32), body);
const controller = physics.createCharacterController(0.02);
controller.enableAutostep(0.5, 0.2, true); controller.enableSnapToGround(0.5);
const player = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.1, 4, 8), M.player);
player.castShadow = true; scene.add(player);

const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
// the run: each lantern in turn, then the shrine, then round again
const route = [...W.LANTERNS, W.SHRINE];
let yaw = W.SPAWN.yaw, vy = 0, leg = 0;
const camPin = q.get('cam')?.split(',').map(Number);
function step(dt) {
  let fwd = 0, turn = 0;
  if (q.get('auto')) {
    const g = route[leg], p = body.translation();
    const want = Math.atan2(-(g.x - p.x), -(g.z - p.z));
    turn = Math.max(-1, Math.min(1, (((want - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 2));
    fwd = 1;
    if (Math.hypot(g.x - p.x, g.z - p.z) < 3) leg = (leg + 1) % route.length;
  } else {
    fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    turn = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  }
  yaw += turn * 2.4 * dt;
  vy = controller.computedGrounded() ? 0 : vy - 9.81 * dt;
  const speed = 5;
  const move = { x: -Math.sin(yaw) * fwd * speed * dt, y: vy * dt, z: -Math.cos(yaw) * fwd * speed * dt };
  controller.computeColliderMovement(capsule, move);
  const m = controller.computedMovement(), p = body.translation();
  body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
  physics.step();
  const t = body.translation();
  player.position.set(t.x, t.y, t.z); player.rotation.y = yaw;
  moon.target.position.set(t.x, 0, t.z - 15); moon.position.set(t.x + W.MOON_DIRECTION.x * 150, 120, t.z - 15 + W.MOON_DIRECTION.z * 150);
  if (camPin) { camera.position.set(camPin[0], camPin[1], camPin[2]); camera.lookAt(camPin[3], camPin[4], camPin[5]); }
  else {
    camera.position.set(t.x + Math.sin(yaw) * 6, t.y + 2.6, t.z + Math.cos(yaw) * 6);
    camera.lookAt(t.x - Math.sin(yaw) * 10, t.y + 1.2, t.z - Math.cos(yaw) * 10);
  }
}

// ---------- post: bloom on both tiers (the phone look is carried by emissive and bloom) ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight).multiplyScalar(phone ? 0.5 : 1), 0.9, 0.55, 0.55));
composer.addPass(new OutputPass());

// ---------- the loop, capped at 60 fps (Jake plays on this laptop) ----------
const hud = document.getElementById('hud');
const clock = new THREE.Clock();
let last = 0, frames = 0;
const intervals = [];
window.__frames = 0;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (t - last < 1 / 60 - 0.002) return;
  const dt = Math.min(0.05, t - last);
  if (frames > 60) intervals.push(t - last);
  last = t;
  step(dt);
  lanterns.forEach((l, i) => { l.position.y = Math.max(W.WATER_LEVEL, W.groundHeight(l.position.x, l.position.z)) + Math.sin(t * 2 + i) * 0.05; });
  motes.forEach((m, i) => { m.position.y = Math.sin(t * 0.4 + i) * 0.3; m.position.x = Math.sin(t * 0.13 + i * 2) * 0.8; });
  composer.render();
  if (frames === 30) { renderer.info.reset(); renderer.info.autoReset = false; renderer.render(scene, camera); window.__stats = { tris: renderer.info.render.triangles, draws: renderer.info.render.calls, lamps: lamps.length }; renderer.info.autoReset = true; }
  frames++; window.__frames = frames; window.__ready = true;
  if (intervals.length > 30) {
    const s = [...intervals].sort((a, b) => a - b);
    window.__fps = { median: 1 / s[Math.floor(s.length / 2)], p5: 1 / s[Math.floor(s.length * 0.95)], samples: s.length };
    if (intervals.length > 1200) intervals.splice(0, intervals.length - 1200);
  }
  if (hud && frames % 30 === 0) hud.textContent = `${phone ? 'phone' : 'desktop'} ${window.__fps ? window.__fps.median.toFixed(1) : '-'} fps ${window.__stats ? `${window.__stats.tris} tris ${window.__stats.draws} draws ${window.__stats.lamps} lamps` : ''}`;
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
