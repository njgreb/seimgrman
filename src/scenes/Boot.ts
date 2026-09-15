import Phaser from 'phaser';
import { createFont } from '../art/font';
import { generateBackground, generateCharacters, generateProps, generateTiles, type Manifest } from '../art/generate';
import { BOSSES, bossById } from '../data/bosses';
import { progress } from '../state';

// Loads any processed art listed in assets/manifest.json (written by tools/pixelize.ts),
// then draws every texture. Bosses without imported art fall back to trait-drawn heads.
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.json('manifest', 'assets/manifest.json');
  }

  create(): void {
    const manifest: Manifest = this.cache.json.get('manifest') ?? { bosses: {} };
    for (const [id, files] of Object.entries(manifest.bosses ?? {})) {
      if (files.portrait) this.load.image(`raw-portrait-${id}`, files.portrait);
      if (files.head) this.load.image(`raw-head-${id}`, files.head);
    }
    this.load.once('complete', () => this.finish());
    this.load.start();
  }

  private finish(): void {
    createFont(this);
    generateProps(this);
    generateCharacters(this);
    for (const boss of BOSSES) {
      generateTiles(this, `tile-${boss.id}`, boss.theme.tile, boss.theme.tileLight);
      generateBackground(this, `bg-${boss.id}`, boss.theme.bg, boss.theme.pattern);
    }

    // Dev shortcuts: ?boss=<id> jumps into a fight, ?weapons=all grants every weapon,
    // ?results / ?initials show the score and name entry screens with sample stats, ?scores the high score board.
    const params = new URLSearchParams(window.location.search);
    for (const [param, scene] of [['results', 'Results'], ['initials', 'NameEntry'], ['scores', 'Leaderboard']]) {
      if (!params.has(param)) continue;
      progress.stats = { fightMs: 252_400, shots: 131, shotsLanded: 83, hitsTaken: 9 };
      this.scene.start(scene, { mode: 'after' });
      return;
    }
    if (params.get('weapons') === 'all') progress.weapons = ['buster', ...BOSSES.map((b) => b.reward)];
    const bossId = params.get('boss');
    if (bossId && BOSSES.some((b) => b.id === bossId)) {
      if (params.get('weapons') !== 'all') progress.weapons = ['buster'];
      this.scene.start('Arena', { bossId: bossById(bossId).id });
      return;
    }
    this.scene.start('Title');
  }
}
