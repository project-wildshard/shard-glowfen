// The lantern run (SHARD-SOURCE SS14b): "Light the shrine". Each spirit lantern is a region trigger that files its flag
// when a player reaches it (the player gathers it); the shrine's trigger fires only once all six are gathered (`when`), and
// that lights the shrine. Carrying a lantern as an item, the raft and a shrine several players fill together (the lantern
// relay, SS10d SHOULD 9) have no host in the format yet: meta SHARD-SOURCE rows SS-GF1 and SS-GF2.
import { LANTERNS, SHRINE } from './world';

const flag = (i: number): string => `glowfen.lantern.${String(i + 1)}`;
const gathered = LANTERNS.map((_, i) => flag(i));

/** The quest section `defineShard`'s `extend` adds. */
export const LANTERN_RUN = {
  flags: [...gathered, 'glowfen.shrine', 'glowfen.lit'],
  triggers: [
    ...LANTERNS.map((l, i) => ({ id: flag(i), kind: 'region' as const, flag: flag(i), x: l.x, z: l.z, radius: 6 })),
    { id: 'glowfen.shrine', kind: 'region' as const, flag: 'glowfen.shrine', x: SHRINE.x, z: SHRINE.z, radius: 9, when: { all: gathered } },
  ],
  dialogue: [],
  quests: [{
    id: 'glowfen.lit', title: 'Light the shrine', track: true, completeFlag: 'glowfen.lit',
    intro: { objective: 'Gather the spirit lanterns; three glow by the jetty', chip: 'Lanterns' },
    steps: [
      {
        id: 'gather', objective: 'Gather the six spirit lanterns', chip: 'Lanterns', done: { all: gathered }, count: gathered,
        markers: LANTERNS.map((l, i) => ({ id: `lantern-${String(i + 1)}`, label: 'Spirit lantern', short: 'Lantern', at: { poi: 'world' as const, x: l.x, z: l.z }, hideWhen: { all: [flag(i)] } })),
      },
      {
        id: 'shrine', objective: 'Bring the lanterns to the shrine', chip: 'Shrine', done: { all: ['glowfen.shrine'] },
        markers: [{ id: 'shrine', label: 'Lantern shrine', short: 'Shrine', at: { poi: 'world' as const, x: SHRINE.x, z: SHRINE.z } }],
      },
    ],
    onComplete: { fact: 'glowfen.lit', coins: 20 },
  }],
};
