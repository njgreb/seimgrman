import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import type { ShotSpec } from '../data/types';

export class Shot extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  age = 0;
  mem: Record<string, unknown> = {};

  constructor(scene: Phaser.Scene, readonly spec: ShotSpec) {
    super(scene, spec.x, spec.y, spec.texture);
    scene.add.existing(this);
  }

  // Must be called after the shot is added to a physics group (the group resets body defaults).
  launch(): this {
    const { spec, body } = this;
    body.setAllowGravity(!!spec.gravity);
    body.setVelocity(spec.vx ?? 0, spec.vy ?? 0);
    body.setAcceleration(spec.ax ?? 0, spec.ay ?? 0);
    if ((spec.vx ?? 0) < 0) this.setFlipX(true);
    return this;
  }

  get damage(): number {
    return this.spec.damage;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    this.age += delta;
    this.spec.update?.(this, delta);
    if (!this.active) return;
    if (this.spec.lifespan && this.age > this.spec.lifespan) return void this.destroy();
    const margin = this.spec.keepOffscreen ? 64 : 12;
    if (this.x < -margin || this.x > WIDTH + margin || this.y > HEIGHT + margin || this.y < -96) this.destroy();
  }
}
