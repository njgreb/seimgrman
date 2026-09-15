import Phaser from 'phaser';
import { HEIGHT, MAX_ENERGY, WIDTH } from '../config';
import { hexToInt } from '../art/palette';
import { sfx } from '../audio/sfx';
import { WEAPONS, WEAPON_ORDER } from '../data/weapons';
import { PROMPTS, onMenu } from '../input';
import { text } from '../ui/text';
import type { Arena } from './Arena';

export class Pause extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    const arena = this.scene.get('Arena') as Arena;
    const player = arena.player;
    const owned = WEAPON_ORDER.filter((id) => player.owned.includes(id));
    let index = Math.max(0, owned.indexOf(player.weapon));

    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.8);
    text(this, WIDTH / 2, 30, 'PAUSED', { align: 'center', scale: 2, color: 'f8d878' });

    const top = 64;
    const g = this.add.graphics();
    owned.forEach((id, i) => {
      const w = WEAPONS[id];
      const y = top + i * 20;
      text(this, 48, y, w.name, { color: w.colors[0] === '0078f8' ? '3cbcfc' : w.colors[1] });
      if (w.cost > 0) {
        g.fillStyle(0x383838).fillRect(48, y + 10, MAX_ENERGY * 2 + 2, 4);
        for (let e = 0; e < (player.energy[id] ?? 0); e++) g.fillStyle(hexToInt(w.colors[1])).fillRect(49 + e * 2, y + 11, 1, 2);
      }
    });
    const cursor = text(this, 36, top, '>', { color: 'f8f8f8' });
    const desc = text(this, WIDTH / 2, HEIGHT - 44, '', { align: 'center', color: 'bcbcbc' });
    const refresh = () => {
      cursor.y = top + index * 20;
      desc.setText(WEAPONS[owned[index]].description);
    };
    refresh();
    text(this, WIDTH / 2, HEIGHT - 24, PROMPTS.pause, { align: 'center', color: '787878' });

    const resume = () => {
      player.setWeapon(owned[index]);
      this.scene.resume('Arena');
      this.scene.stop();
    };
    const quit = () => {
      this.scene.stop('Arena');
      this.scene.start('BossSelect');
    };

    onMenu(this, (action) => {
      if (action === 'up' || action === 'down') {
        index = (index + (action === 'up' ? -1 : 1) + owned.length) % owned.length;
        sfx.cursor();
        refresh();
      } else if (action === 'start' || action === 'confirm') {
        resume();
      } else if (action === 'select') {
        quit();
      }
    });
    this.input.keyboard!.on('keydown-ESC', quit);
  }
}
