import { oncallMan } from '../bosses/oncall';
import { roadmapMan } from '../bosses/roadmap';
import { syncMan } from '../bosses/sync';
import { ticketMan } from '../bosses/ticket';
import type { BossDef } from './types';

// Boss select order. Up to 8 bosses fit the select grid.
export const BOSSES: BossDef[] = [syncMan, ticketMan, roadmapMan, oncallMan];

export function bossById(id: string): BossDef {
  const boss = BOSSES.find((b) => b.id === id);
  if (!boss) throw new Error(`Unknown boss: ${id}`);
  return boss;
}
