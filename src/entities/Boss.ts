import Phaser from 'phaser';
import { BOSS_INVULN_MS, FLOOR_Y, GRAVITY, MAX_HP, TILE, WEAKNESS_DAMAGE, WIDTH } from '../config';
import { FRAMES } from '../art/characters';
import { sfx } from '../audio/sfx';
import type { BossDef, BossPattern, ShotSpec } from '../data/types';
import { WEAPONS } from '../data/weapons';
import type { Arena } from '../scenes/Arena';
import type { Shot } from './Shot';

// Thrown out of a pattern when the fight ends mid-attack.
class Cancelled extends Error {}

export class Boss extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  hp: number;
  readonly maxHp: number;
  facing: 1 | -1 = -1;
  alive = true;
  private invulnUntil = 0;
  private shootUntil = 0;
  private poseFrame: number | null = null;
  private lastPattern: BossPattern | null = null;
  private readonly texKey: string;

  constructor(readonly arena: Arena, x: number, y: number, readonly def: BossDef) {
    super(arena, x, y, `boss-${def.id}`, FRAMES.idle);
    this.texKey = `boss-${def.id}`;
    this.hp = def.hp ?? MAX_HP;
    this.maxHp = this.hp;
    arena.add.existing(this);
    arena.physics.add.existing(this);
    this.body.setSize(14, 26).setOffset(5, 6);
    this.body.setMaxVelocityY(420);
    this.setFlipX(true);
    // Scene event listeners outlive a scene restart; make sure pending waits bail out.
    arena.events.once('shutdown', () => (this.alive = false));
  }

  get player() {
    return this.arena.player;
  }

  get enraged(): boolean {
    return this.hp <= this.maxHp / 2;
  }

  get onFloor(): boolean {
    return this.body.blocked.down;
  }

  get muzzle(): { x: number; y: number } {
    return { x: this.x + this.facing * 12, y: this.y + 2 };
  }

  // ---- fight loop ----

  async run(): Promise<void> {
    try {
      await this.wait(600);
      for (;;) {
        const options = this.def.patterns.filter((p) => p !== this.lastPattern || this.def.patterns.length === 1);
        const pattern = options[Math.floor(Math.random() * options.length)];
        this.lastPattern = pattern;
        await pattern(this);
        this.guard();
        this.pose(null);
        this.face();
        await this.wait(this.enraged ? 350 : 700);
      }
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
    }
  }

  private guard(): void {
    if (!this.alive || this.arena.over || !this.active) throw new Cancelled();
  }

  // ---- helpers for pattern scripts ----

  async wait(ms: number): Promise<void> {
    await new Promise<void>((resolve) => this.arena.time.delayedCall(ms, resolve));
    this.guard();
  }

  async waitUntil(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
    await new Promise<void>((resolve) => {
      let elapsed = 0;
      const tick = (_t: number, delta: number) => {
        elapsed += delta;
        if (!this.alive || !this.active || this.arena.over || elapsed > timeoutMs || predicate()) {
          this.arena.events.off('update', tick);
          resolve();
        }
      };
      this.arena.events.on('update', tick);
    });
    this.guard();
  }

  face(): void {
    this.facing = this.player.x < this.x ? -1 : 1;
    this.setFlipX(this.facing < 0);
  }

  pose(frame: number | null): void {
    this.poseFrame = frame;
  }

  say(text: string, ms = 900): void {
    this.arena.say(text, this.x, this.y - 26, ms);
  }

  async telegraph(ms: number): Promise<void> {
    this.pose(FRAMES.attack);
    const flash = this.arena.time.addEvent({
      delay: 70,
      repeat: Math.floor(ms / 70),
      callback: () => (this.isTinted ? this.clearTint() : this.setTintFill(0xffffff)),
    });
    await this.wait(ms);
    flash.remove();
    this.clearTint();
    this.pose(null);
  }

  angleToPlayer(from = this.muzzle): number {
    return Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(from.x, from.y, this.player.x, this.player.y + 4));
  }

  velocity(angleDeg: number, speed: number): { vx: number; vy: number } {
    const r = Phaser.Math.DegToRad(angleDeg);
    return { vx: Math.cos(r) * speed, vy: Math.sin(r) * speed };
  }

  fire(spec: Omit<ShotSpec, 'x' | 'y'> & { x?: number; y?: number }, sound = true): Shot {
    const m = this.muzzle;
    this.shootUntil = this.arena.time.now + 250;
    if (sound) sfx.enemyShoot();
    return this.arena.spawnEnemyShot({ ...spec, x: spec.x ?? m.x, y: spec.y ?? m.y });
  }

  // Ballistic jump that lands at targetX (floor height), peaking `peak` px above the start.
  async jumpTo(targetX: number, peak = 64): Promise<void> {
    targetX = Phaser.Math.Clamp(targetX, TILE + 12, WIDTH - TILE - 12);
    const vy = -Math.sqrt(2 * GRAVITY * peak);
    const flight = (2 * -vy) / GRAVITY;
    this.facing = targetX < this.x ? -1 : 1;
    this.setFlipX(this.facing < 0);
    this.body.setVelocity((targetX - this.x) / flight, vy);
    await this.wait(80);
    await this.waitUntil(() => this.onFloor);
    this.body.setVelocityX(0);
  }

  async dashTo(targetX: number, speed: number): Promise<void> {
    targetX = Phaser.Math.Clamp(targetX, TILE + 12, WIDTH - TILE - 12);
    const dir = targetX < this.x ? -1 : 1;
    this.facing = dir;
    this.setFlipX(dir < 0);
    this.body.setVelocityX(dir * speed);
    await this.waitUntil(() => (dir > 0 ? this.x >= targetX : this.x <= targetX) || this.body.blocked.left || this.body.blocked.right);
    this.body.setVelocityX(0);
  }

  async teleport(x: number): Promise<void> {
    sfx.teleport();
    this.body.enable = false;
    for (let i = 0; i < 6; i++) {
      this.setVisible(!this.visible);
      await this.wait(50);
    }
    this.setVisible(false);
    await this.wait(250);
    this.setPosition(Phaser.Math.Clamp(x, TILE + 12, WIDTH - TILE - 12), FLOOR_Y - 16);
    this.face();
    for (let i = 0; i < 6; i++) {
      this.setVisible(!this.visible);
      await this.wait(50);
    }
    this.setVisible(true);
    this.body.enable = true;
  }

  // Random floor x at least `minGap` px from the player.
  randomX(minGap = 64): number {
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(TILE + 16, WIDTH - TILE - 16);
      if (Math.abs(x - this.player.x) >= minGap) return x;
    }
    return this.player.x < WIDTH / 2 ? WIDTH - 48 : 48;
  }

  // ---- damage ----

  takeHit(shot: Shot): boolean {
    const now = this.arena.time.now;
    if (!this.alive || now < this.invulnUntil) return false;
    const weapon = shot.spec.weapon ?? 'buster';
    const weak = weapon === this.def.weakness;
    const damage = weak ? WEAKNESS_DAMAGE : WEAPONS[weapon]?.damage ?? shot.damage;
    this.hp = Math.max(0, this.hp - damage);
    this.invulnUntil = now + BOSS_INVULN_MS;
    sfx.bossHit();
    this.arena.spark(shot.x, shot.y);
    if (weak) this.arena.say('CRITICAL!', this.x, this.y - 26, 400);
    if (this.hp <= 0) {
      this.alive = false;
      this.body.setVelocity(0, 0);
      this.body.enable = false;
      this.arena.onBossDefeated();
    }
    return true;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.alive) return;

    this.setAlpha(time < this.invulnUntil && Math.floor(time / 40) % 2 === 0 ? 0.4 : 1);

    const moving = Math.abs(this.body.velocity.x) > 1;
    const shooting = time < this.shootUntil;
    if (!this.onFloor) {
      this.anims.stop();
      this.setFrame(shooting ? FRAMES.jumpShoot : FRAMES.jump);
    } else if (moving) {
      const key = `${this.texKey}-${shooting ? 'runShoot' : 'run'}`;
      if (this.anims.currentAnim?.key !== key || !this.anims.isPlaying) this.anims.play(key);
    } else {
      this.anims.stop();
      this.setFrame(this.poseFrame ?? (shooting ? FRAMES.shoot : FRAMES.idle));
    }
  }
}
