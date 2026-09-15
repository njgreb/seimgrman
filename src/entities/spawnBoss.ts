import { WIDTH } from '../config';
import type { BossDef } from '../data/types';
import type { Arena } from '../scenes/Arena';
import { Boss } from './Boss';
import { Capsule } from './Capsule';
import { ReorgMachine } from './ReorgMachine';

// Builds the boss entity for a fight (or one phase of a multi-phase fight). `from` is where a later
// phase emerges, e.g. the wreck of the previous one.
export function spawnBoss(arena: Arena, def: BossDef, phase: number, from?: { x: number; y: number }): Boss {
  const stage = def.phases?.[phase];
  if (!stage) return new Boss(arena, WIDTH - 56, -40, def);
  const phaseDef: BossDef = { ...def, hp: stage.hp ?? def.hp, weakness: stage.weakness, patterns: stage.patterns };
  if (stage.body === 'machine') return new ReorgMachine(arena, phaseDef);
  return new Capsule(arena, phaseDef, from?.x ?? WIDTH + 24, from?.y ?? -24);
}
