import { emptyStats } from './score';

// Progress for the current run. Intentionally not persisted: each onsite player starts fresh.
export const progress = {
  defeated: new Set<string>(),
  weapons: ['buster'] as string[],
  stats: emptyStats(),
  practice: false, // started from a dev shortcut (?boss=...): scored, but never sent to the leaderboard
  reset(): void {
    this.defeated.clear();
    this.weapons = ['buster'];
    this.stats = emptyStats();
    this.practice = false;
  },
};
