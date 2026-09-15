import Phaser from 'phaser';
import {
  ENERGY_REGEN_MS,
  JUMP_VELOCITY,
  MAX_ENERGY,
  MAX_FALL,
  MAX_HP,
  PLAYER_HURT_MS,
  PLAYER_INVULN_MS,
  RUN_SPEED,
} from '../config';
import { FRAMES } from '../art/characters';
import { sfx } from '../audio/sfx';
import { WEAPONS, WEAPON_ORDER } from '../data/weapons';
import type { Controls } from '../input';
import type { Arena } from '../scenes/Arena';
import { progress as run } from '../state';

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  hp = MAX_HP;
  facing: 1 | -1 = 1;
  weapon = 'buster';
  energy: Record<string, number> = {};
  controllable = false;
  dead = false;
  private hurtUntil = 0;
  private invulnUntil = 0;
  private frozenUntil = 0;
  private shootUntil = 0;
  private wasOnFloor = true;
  private jumpHeld = false;
  private regenAt = 0;

  constructor(readonly arena: Arena, x: number, y: number, private readonly controls: Controls, readonly owned: string[]) {
    super(arena, x, y, 'player-buster', FRAMES.idle);
    arena.add.existing(this);
    arena.physics.add.existing(this);
    this.body.setSize(12, 24).setOffset(6, 8);
    this.body.setMaxVelocityY(MAX_FALL);
    for (const id of owned) this.energy[id] = MAX_ENERGY;
  }

  get onFloor(): boolean {
    return this.body.blocked.down;
  }

  get texKey(): string {
    return `player-${this.weapon}`;
  }

  setWeapon(id: string): void {
    if (!this.owned.includes(id) || id === this.weapon) return;
    this.weapon = id;
    this.setTexture(this.texKey, FRAMES.idle);
    this.arena.hud.flashWeapon(WEAPONS[id].name);
    sfx.cursor();
  }

  cycleWeapon(dir: 1 | -1): void {
    const owned = WEAPON_ORDER.filter((id) => this.owned.includes(id));
    const i = owned.indexOf(this.weapon);
    this.setWeapon(owned[(i + dir + owned.length) % owned.length]);
  }

  freeze(ms: number): void {
    this.frozenUntil = this.arena.time.now + PLAYER_HURT_MS + ms;
    sfx.freeze();
  }

  damage(amount: number, sourceX: number): boolean {
    const now = this.arena.time.now;
    if (this.dead || !this.controllable || now < this.invulnUntil) return false;
    this.hp = Math.max(0, this.hp - amount);
    run.stats.hitsTaken++;
    if (this.hp <= 0) {
      this.dead = true;
      this.body.enable = false;
      this.setVisible(false);
      this.arena.onPlayerDied();
      return true;
    }
    sfx.hurt();
    this.hurtUntil = now + PLAYER_HURT_MS;
    this.invulnUntil = now + PLAYER_INVULN_MS;
    this.facing = sourceX < this.x ? -1 : 1;
    this.setFlipX(this.facing < 0);
    this.body.setVelocity(-this.facing * 40, Math.max(0, this.body.velocity.y));
    this.arena.spark(this.x, this.y);
    return true;
  }

  private show(frame: number): void {
    this.anims.stop();
    this.setFrame(frame);
  }

  private run(shooting: boolean): void {
    const key = `${this.texKey}-${shooting ? 'runShoot' : 'run'}`;
    if (this.anims.currentAnim?.key === key && this.anims.isPlaying) return;
    const progress = this.anims.isPlaying ? (this.anims.currentFrame?.index ?? 0) : 0;
    this.anims.play({ key, startFrame: progress % 4 });
  }

  private fire(time: number): void {
    const w = WEAPONS[this.weapon];
    if ((this.energy[w.id] ?? 0) < w.cost) return;
    const volley = run.stats.shots;
    const fired = w.fire({
      x: this.x + this.facing * 14,
      y: this.y + 2,
      facing: this.facing,
      onFloor: this.onFloor,
      playerX: () => this.x,
      count: (id) => this.arena.countPlayerShots(id),
      spawn: (spec) => this.arena.spawnPlayerShot({ ...spec, weapon: w.id, volley }),
    });
    if (!fired) return;
    run.stats.shots++;
    this.energy[w.id] -= w.cost;
    this.shootUntil = time + 250;
    if (w.id === 'buster') sfx.shoot();
    else sfx.weapon();
  }

  update(time: number): void {
    const pressed = new Set(this.controls.pressed);
    this.controls.pressed.clear();
    if (this.dead) return;
    if (this.controllable && time >= this.regenAt) {
      this.regenAt = time + ENERGY_REGEN_MS;
      for (const id of this.owned) this.energy[id] = Math.min(MAX_ENERGY, (this.energy[id] ?? 0) + 1);
    }
    const onFloor = this.onFloor;
    if (onFloor && !this.wasOnFloor) sfx.land();
    this.wasOnFloor = onFloor;

    this.setVisible(time < this.invulnUntil ? Math.floor(time / 50) % 2 === 0 : true);

    if (time < this.hurtUntil) {
      this.show(FRAMES.hurt);
      return;
    }

    const frozen = time < this.frozenUntil;
    if (frozen) this.setTint(0x88ccff);
    else if (this.isTinted) this.clearTint();

    if (!this.controllable || frozen) {
      this.body.setVelocityX(0);
      this.show(onFloor ? FRAMES.idle : FRAMES.jump);
      return;
    }

    const c = this.controls;
    if (pressed.has('prev')) this.cycleWeapon(-1);
    if (pressed.has('next')) this.cycleWeapon(1);

    const dir = (c.isDown('left') ? -1 : 0) + (c.isDown('right') ? 1 : 0);
    this.body.setVelocityX(dir * RUN_SPEED);
    if (dir !== 0) {
      this.facing = dir as 1 | -1;
      this.setFlipX(dir < 0);
    }

    if (pressed.has('jump') && onFloor) {
      this.body.setVelocityY(JUMP_VELOCITY);
      this.jumpHeld = true;
    }
    // Variable jump height: releasing jump cuts the ascent. A same-frame tap still gets a small hop.
    if (!c.isDown('jump') && this.body.velocity.y < 0 && !this.jumpHeld) this.body.setVelocityY(0);
    this.jumpHeld = false;

    if (pressed.has('shoot')) this.fire(time);

    const shooting = time < this.shootUntil;
    if (!onFloor) this.show(shooting ? FRAMES.jumpShoot : FRAMES.jump);
    else if (dir !== 0) this.run(shooting);
    else this.show(shooting ? FRAMES.shoot : FRAMES.idle);
  }
}
