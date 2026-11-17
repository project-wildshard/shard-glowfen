import { defineShard } from '@wildshard/sdk/scene/shard';
import identity from '../identity.json' with { type: 'json' };
import { LANTERN_RUN } from './lanterns';
import { buildGlowfen } from './world';

/** This shard: the scene `world.ts` builds and the lantern run (`lanterns.ts`), under this project's identity. */
export const shard = defineShard(identity, buildGlowfen, { extend: (data) => ({ ...data, quests: LANTERN_RUN }) });
