// Progress for the current run. Intentionally not persisted: each onsite player starts fresh.
export const progress = {
  defeated: new Set<string>(),
  weapons: ['buster'] as string[],
  reset(): void {
    this.defeated.clear();
    this.weapons = ['buster'];
  },
};
