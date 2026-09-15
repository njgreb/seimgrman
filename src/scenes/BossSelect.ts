import Phaser from 'phaser';
import { PLAYER_NAME, WIDTH } from '../config';
import { sfx } from '../audio/sfx';
import { BOSSES } from '../data/bosses';
import { onMenu } from '../input';
import { progress } from '../state';
import { sleep, starfield, text } from '../ui/text';

const CELL_W = 80;
const CELL_H = 68;
const ORIGIN_X = (WIDTH - CELL_W * 3) / 2;
const ORIGIN_Y = 26;
// Corners first, then edges; slot 4 (center) is the player.
const SLOT_ORDER = [0, 2, 6, 8, 1, 3, 5, 7];

function slotCenter(slot: number): { x: number; y: number } {
  return { x: ORIGIN_X + (slot % 3) * CELL_W + CELL_W / 2, y: ORIGIN_Y + Math.floor(slot / 3) * CELL_H + 26 };
}

function splitName(name: string): string {
  if (name.length * 6 <= CELL_W - 4) return name;
  const i = name.lastIndexOf(' ');
  return i > 0 ? `${name.slice(0, i)}\n${name.slice(i + 1)}` : name;
}

export class BossSelect extends Phaser.Scene {
  private cursor = 0;
  private locked = false;

  constructor() {
    super('BossSelect');
  }

  create(): void {
    this.locked = false;
    const remaining = BOSSES.filter((b) => !progress.defeated.has(b.id));
    if (remaining.length === 0) {
      this.scene.start('Fortress'); // every manager is down: on to HQ
      return;
    }
    this.cursor = BOSSES.indexOf(remaining[0]);

    this.cameras.main.setBackgroundColor('#000040');
    starfield(this, 40, 15);
    text(this, WIDTH / 2, 8, 'SCHEDULE YOUR 1:1', { align: 'center', color: 'f8d878' });

    const g = this.add.graphics();
    const frame = (slot: number, color: number) => {
      const c = slotCenter(slot);
      g.fillStyle(0x000000).fillRect(c.x - 27, c.y - 27, 54, 54);
      g.lineStyle(2, color).strokeRect(c.x - 27, c.y - 27, 54, 54);
    };

    const pc = slotCenter(4);
    frame(4, 0x3cbcfc);
    this.add.image(pc.x, pc.y, 'portrait-player');
    text(this, pc.x, pc.y + 31, PLAYER_NAME, { align: 'center', color: '3cbcfc' });

    BOSSES.slice(0, SLOT_ORDER.length).forEach((boss, i) => {
      const slot = SLOT_ORDER[i];
      const c = slotCenter(slot);
      const done = progress.defeated.has(boss.id);
      frame(slot, done ? 0x383838 : 0xbcbcbc);
      const img = this.add.image(c.x, c.y, `portrait-${boss.id}`);
      if (done) img.setTint(0x303030);
      text(this, c.x, c.y + 31, splitName(boss.name), { align: 'center', color: done ? '787878' : 'f8f8f8' });
    });

    const cursorG = this.add.graphics();
    const drawCursor = () => {
      cursorG.clear();
      const c = slotCenter(SLOT_ORDER[this.cursor]);
      cursorG.lineStyle(2, 0xf8b800);
      const s = 31;
      const l = 8;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = c.x + sx * s;
        const y = c.y + sy * s;
        cursorG.lineBetween(x, y, x - sx * l, y).lineBetween(x, y, x, y - sy * l);
      }
    };
    drawCursor();
    this.time.addEvent({ delay: 250, loop: true, callback: () => cursorG.setVisible(!cursorG.visible) });

    onMenu(this, (action) => {
      if (this.locked) return;
      const dirs: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      if (action in dirs) {
        const next = this.move(dirs[action]);
        if (next !== this.cursor) {
          this.cursor = next;
          sfx.cursor();
          drawCursor();
          cursorG.setVisible(true);
        }
      } else if (action === 'confirm' || action === 'start') {
        void this.choose();
      }
    });
  }

  // Pick the nearest boss slot in the pressed direction.
  private move([dx, dy]: [number, number]): number {
    const from = SLOT_ORDER[this.cursor];
    const fx = from % 3;
    const fy = Math.floor(from / 3);
    let best = this.cursor;
    let bestScore = Infinity;
    BOSSES.slice(0, SLOT_ORDER.length).forEach((_, i) => {
      if (i === this.cursor) return;
      const s = SLOT_ORDER[i];
      const vx = (s % 3) - fx;
      const vy = Math.floor(s / 3) - fy;
      const along = vx * dx + vy * dy;
      if (along <= 0) return;
      const across = Math.abs(vx * dy) + Math.abs(vy * dx);
      const score = along + across * 2;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    return best;
  }

  private async choose(): Promise<void> {
    const boss = BOSSES[this.cursor];
    if (progress.defeated.has(boss.id)) return;
    this.locked = true;
    sfx.select();
    this.cameras.main.flash(300, 255, 255, 255);
    await sleep(this, 500);
    this.scene.start('BossIntro', { bossId: boss.id });
  }
}
