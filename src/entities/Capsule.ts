import Phaser from 'phaser';
import { TILE, WIDTH } from '../config';
import { sfx } from '../audio/sfx';
import type { BossDef } from '../data/types';
import type { Arena } from '../scenes/Arena';
import { Boss } from './Boss';

// CTO MAN phase 2: the pilot's escape pod. Flies, teleports, ignores gravity.
export class Capsule extends Boss {
  constructor(arena: Arena, def: BossDef, x: number, y: number) {
    super(arena, x, y, def);
    this.setTexture('cto-capsule');
    this.body.setAllowGravity(false);
    this.body.setSize(28, 24).setOffset(4, 2);
  }

  get muzzle(): { x: number; y: number } {
    return { x: this.x, y: this.y + 4 };
  }

  say(message: string, ms = 900): void {
    this.arena.say(message, this.x, this.y - 26, ms);
  }

  async enter(): Promise<void> {
    await this.flyTo(WIDTH - 64, 84, 160);
    this.face();
    await this.wait(300);
  }

  // Straight-line flight at `speed` px/s.
  async flyTo(x: number, y: number, speed: number): Promise<void> {
    x = Phaser.Math.Clamp(x, TILE + 16, WIDTH - TILE - 16);
    const dist = Phaser.Math.Distance.Between(this.x, this.y, x, y);
    if (dist < 2) return;
    this.facing = x < this.x ? -1 : 1;
    this.setFlipX(this.facing < 0);
    this.body.setVelocity(((x - this.x) / dist) * speed, ((y - this.y) / dist) * speed);
    await this.waitUntil(() => Phaser.Math.Distance.Between(this.x, this.y, x, y) < (speed / 60) * 1.5, (dist / speed) * 1000 + 500);
    this.body.reset(x, y);
  }

  async teleportTo(x: number, y: number): Promise<void> {
    sfx.teleport();
    this.body.enable = false;
    for (let i = 0; i < 6; i++) {
      this.setVisible(!this.visible);
      await this.wait(50);
    }
    this.setVisible(false);
    await this.wait(250);
    this.body.enable = true;
    this.body.reset(Phaser.Math.Clamp(x, TILE + 16, WIDTH - TILE - 16), y);
    this.face();
    for (let i = 0; i < 6; i++) {
      this.setVisible(!this.visible);
      await this.wait(50);
    }
    this.setVisible(true);
  }

  protected animate(): void {
    // no walk cycle: the pod just hovers
  }
}
