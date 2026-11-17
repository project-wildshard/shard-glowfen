// The cleanroom's night sky dome (cleanroom/src/main.js `skyMat`) in TSL, line for line (SHARD-SOURCE SS14a): an ink
// zenith, a blue band at the horizon, and the moon low over the shrine with its halo. `world.sky(...)` compiles it to the
// dome's graph.
import * as THREE from 'three';
import { dot, max, mix, pow, smoothstep, vec3 } from 'three/tsl';
import { skyRay } from '@wildshard/sdk/scene/author';
import type { GraphValue } from '@wildshard/sdk/materials';

type V = ReturnType<typeof vec3>;
const lin = (hex: string): V => { const c = new THREE.Color(hex); return vec3(c.r, c.g, c.b); };
const SKY = { top: '#050816', mid: '#1b2a4a', bottom: '#0a1220', moon: '#9fb8ff' };
/** Where the moon sits: low in the north-west, over the shrine. */
export const MOON_DIRECTION = new THREE.Vector3(-0.4, 0.35, -1).normalize();

/** The sky colour along the view ray. */
export function nightSky(): GraphValue {
  const d = skyRay, h = d.y;
  const above = mix(lin(SKY.mid), lin(SKY.top), pow(smoothstep(0, 1, max(h, 0)), 0.45));
  const below = mix(lin(SKY.mid), lin(SKY.bottom), smoothstep(0, -0.2, h));
  let col: V = mix(below, above, smoothstep(-0.001, 0.001, h));
  const md = max(dot(d, vec3(MOON_DIRECTION.x, MOON_DIRECTION.y, MOON_DIRECTION.z)), 0);
  col = col.add(lin(SKY.moon).mul(pow(md, 80).mul(0.25)));
  col = col.add(lin(SKY.moon).mul(smoothstep(0.9993, 0.9995, md).mul(1.6)));
  return col;
}
