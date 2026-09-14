import Phaser from 'phaser';
import { MAX_ENERGY, MAX_HP } from '../config';
import { hexToInt } from '../art/palette';
import { WEAPONS } from '../data/weapons';
import type { Arena } from '../scenes/Arena';
import { text } from './text';

export function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, value: number, max: number, fill: string, core: string): void {
  g.fillStyle(0x000000).fillRect(x, y, 8, max * 2 + 2);
  for (let i = 0; i < Math.round(value); i++) {
    const yy = y + max * 2 - i * 2;
    g.fillStyle(hexToInt(fill)).fillRect(x + 1, yy, 6, 1);
    g.fillStyle(hexToInt(core)).fillRect(x + 3, yy, 2, 1);
  }
}

// Mega Man-style vertical meters: weapon energy, player health, boss health.
export class Hud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.BitmapText;
  private labelTimer?: Phaser.Time.TimerEvent;
  bossDisplay = 0;

  constructor(private readonly arena: Arena) {
    this.g = arena.add.graphics().setDepth(100);
    this.label = text(arena, 42, 20, '', { depth: 100 });
  }

  flashWeapon(name: string): void {
    this.label.setText(name);
    this.labelTimer?.remove();
    this.labelTimer = this.arena.time.delayedCall(1200, () => this.label.setText(''));
  }

  update(): void {
    const { player, boss } = this.arena;
    const g = this.g.clear();
    if (player.weapon !== 'buster') {
      const w = WEAPONS[player.weapon];
      drawBar(g, 8, 16, player.energy[w.id] ?? 0, MAX_ENERGY, w.colors[1], 'f8f8f8');
    }
    drawBar(g, 16, 16, player.hp, MAX_HP, 'fce0a8', 'f8f8f8');
    drawBar(g, 28, 16, Math.min(this.bossDisplay, boss.hp), boss.maxHp, 'f87858', 'fce0a8');
  }
}
