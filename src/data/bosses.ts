import { ctoMan } from '../bosses/cto';
import { oncallMan } from '../bosses/oncall';
import { roadmapMan } from '../bosses/roadmap';
import { syncMan } from '../bosses/sync';
import { ticketMan } from '../bosses/ticket';
import type { BossDef } from './types';

// Boss select order. Up to 8 bosses fit the select grid.
export const BOSSES: BossDef[] = [syncMan, ticketMan, roadmapMan, oncallMan];

// Waits at HQ until every boss above is beaten.
export const FINAL_BOSS: BossDef = ctoMan;

export const ALL_BOSSES: BossDef[] = [...BOSSES, FINAL_BOSS];

export function bossById(id: string): BossDef {
  const boss = ALL_BOSSES.find((b) => b.id === id);
  if (!boss) throw new Error(`Unknown boss: ${id}`);
  return boss;
}
