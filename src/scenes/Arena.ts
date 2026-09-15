import Phaser from 'phaser';
import { CONTACT_DAMAGE, FLOOR_Y, HEIGHT, TILE, WIDTH } from '../config';
import { FRAMES } from '../art/characters';
import { sfx } from '../audio/sfx';
import { bossById } from '../data/bosses';
import type { BossDef, ShotSpec } from '../data/types';
import { type Boss, Cancelled } from '../entities/Boss';
import { Player } from '../entities/Player';
import { Shot } from '../entities/Shot';
import { spawnBoss } from '../entities/spawnBoss';
import { PROMPTS, createControls, onMenu } from '../input';
import { progress } from '../state';
import { Hud } from '../ui/Hud';
import { sleep, text } from '../ui/text';

const DEFAULT_LAYOUT = [
  ...Array.from({ length: 13 }, () => '#..............#'),
  '################',
  '################',
];

const FREEZE_LINES = ["COULD'VE BEEN AN EMAIL", 'SORRY, YOU ARE ON MUTE', "WE'RE WAITING ON A FEW MORE"];

// Merge solid cells into as few rectangles as possible so bodies don't snag on tile seams.
function solidRects(layout: string[]): { x: number; y: number; w: number; h: number }[] {
  const used = layout.map((row) => [...row].map(() => false));
  const solid = (x: number, y: number) => layout[y]?.[x] === '#' && !used[y][x];
  const rects = [];
  for (let y = 0; y < layout.length; y++)
    for (let x = 0; x < layout[y].length; x++) {
      if (!solid(x, y)) continue;
      let w = 1;
      while (solid(x + w, y)) w++;
      let h = 1;
      while (Array.from({ length: w }, (_, i) => solid(x + i, y + h)).every(Boolean)) h++;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used[y + j][x + i] = true;
      rects.push({ x, y, w, h });
    }
  return rects;
}

export class Arena extends Phaser.Scene {
  def!: BossDef;
  player!: Player;
  boss!: Boss;
  hud!: Hud;
  playerShots!: Phaser.Physics.Arcade.Group;
  enemyShots!: Phaser.Physics.Arcade.Group;
  over = false;
  private playerReady = false;
  private fighting = false;
  private resumedAt = 0;
  private landedVolleys = new Set<number>();
  private phase = 0; // multi-phase fights: which phase is (or was, at game over) in progress
  private solids: Phaser.GameObjects.Zone[] = [];
  private bossColliders: Phaser.Physics.Arcade.Collider[] = [];

  constructor() {
    super('Arena');
  }

  init(data: { bossId: string; phase?: number }): void {
    this.def = bossById(data.bossId);
    this.phase = data.phase ?? 0;
    this.bossColliders = [];
    this.over = false;
    this.playerReady = false;
    this.fighting = false;
    this.landedVolleys.clear();
  }

  create(): void {
    const { def } = this;
    const layout = def.layout ?? DEFAULT_LAYOUT;

    this.add.tileSprite(0, 0, WIDTH, HEIGHT, `bg-${def.id}`).setOrigin(0);
    const solids = (this.solids = solidRects(layout).map((r) => {
      const zone = this.add.zone((r.x + r.w / 2) * TILE, (r.y + r.h / 2) * TILE, r.w * TILE, r.h * TILE);
      this.physics.add.existing(zone, true);
      return zone;
    }));
    layout.forEach((row, y) => [...row].forEach((c, x) => c === '#' && this.add.image(x * TILE + 8, y * TILE + 8, `tile-${def.id}`)));

    this.playerShots = this.physics.add.group();
    this.enemyShots = this.physics.add.group();

    this.player = new Player(this, 48, FLOOR_Y - 16, createControls(this), progress.weapons);
    this.player.setVisible(false);
    this.player.body.enable = false;

    this.boss = spawnBoss(this, def, this.phase);
    this.hud = new Hud(this);

    this.physics.add.collider(this.player, solids);
    this.wireBoss();

    this.physics.add.overlap(this.enemyShots, this.player, (a, b) => {
      const shot = (a instanceof Shot ? a : b) as Shot;
      if (!shot.active || !this.player.damage(shot.damage, shot.x)) return;
      if (shot.spec.effect === 'freeze') {
        this.player.freeze(1200);
        this.say(FREEZE_LINES[Math.floor(Math.random() * FREEZE_LINES.length)], this.player.x, this.player.y - 28, 1600);
      }
      if (!shot.spec.pierce) shot.destroy();
    });

    onMenu(this, (action) => {
      if (action !== 'start' || !this.fighting || this.over || this.time.now - this.resumedAt < 250) return;
      this.scene.launch('Pause');
      this.scene.pause();
    });
    this.events.on('resume', () => (this.resumedAt = this.time.now));

    void this.intro();
  }

  private async intro(): Promise<void> {
    // player beams in
    const beam = this.add.image(48, -16, 'fx-beam').setScale(1, 2);
    await new Promise<void>((resolve) => this.tweens.add({ targets: beam, y: FLOOR_Y - 16, duration: 450, onComplete: () => resolve() }));
    beam.destroy();
    sfx.teleport();
    this.player.setVisible(true);
    this.player.body.enable = true;
    this.playerReady = true;

    // boss arrives, health bar fills
    await sleep(this, 300);
    if (!(await this.bossEnters())) return;
    await this.fillBossBar();
    await this.ready();
    if (this.over) return;
    this.startFighting();
  }

  // Colliders belong to one boss body, so a new phase re-wires them.
  private wireBoss(): void {
    this.bossColliders.forEach((c) => c.destroy());
    const boss = this.boss;
    this.bossColliders = [
      this.physics.add.collider(boss, this.solids),
      this.physics.add.overlap(this.playerShots, boss, (a, b) => {
        const shot = (a instanceof Shot ? a : b) as Shot;
        if (!shot.active || shot.mem.hit || !boss.alive) return;
        // Accuracy counts touching the boss, even during its invulnerability flicker.
        const { volley } = shot.spec;
        if (volley !== undefined && boss.countsAsLanded(shot) && !this.landedVolleys.has(volley)) {
          this.landedVolleys.add(volley);
          progress.stats.shotsLanded++;
        }
        if (boss.takeHit(shot)) {
          if (shot.spec.pierce) shot.mem.hit = true;
          else shot.destroy();
        }
      }),
      this.physics.add.overlap(this.player, boss, () => {
        if (boss.alive) this.player.damage(CONTACT_DAMAGE, boss.x);
      }),
    ];
  }

  // False if the scene ended while the boss was still arriving.
  private async bossEnters(): Promise<boolean> {
    try {
      await this.boss.enter();
      return true;
    } catch (e) {
      if (e instanceof Cancelled) return false;
      throw e;
    }
  }

  private async fillBossBar(): Promise<void> {
    for (let i = 0; i <= this.boss.maxHp; i++) {
      this.hud.bossDisplay = i;
      if (i % 2 === 0) sfx.tick();
      await sleep(this, 28);
    }
  }

  private async ready(): Promise<void> {
    const ready = text(this, WIDTH / 2, 100, 'READY', { align: 'center', depth: 50 });
    for (let i = 0; i < 6; i++) {
      ready.setVisible(!ready.visible);
      await sleep(this, 160);
    }
    ready.destroy();
  }

  private startFighting(): void {
    this.fighting = true;
    this.player.controllable = true;
    this.hud.flashWeapon(`VS ${this.def.name}`);
    void this.boss.run();
  }

  update(time: number, delta: number): void {
    if (this.fighting) progress.stats.fightMs += delta; // paused scenes don't update, so pause is free
    if (this.playerReady) this.player.update(time);
    this.hud.update();
  }

  // ---- spawning / effects used by bosses, weapons, and the player ----

  spawnPlayerShot(spec: ShotSpec): Shot {
    const shot = new Shot(this, spec);
    this.playerShots.add(shot);
    return shot.launch();
  }

  spawnEnemyShot(spec: ShotSpec): Shot {
    const shot = new Shot(this, spec);
    this.enemyShots.add(shot);
    return shot.launch();
  }

  countPlayerShots(weaponId: string): number {
    return this.playerShots.getChildren().filter((s) => s.active && (s as Shot).spec.weapon === weaponId).length;
  }

  say(message: string, x: number, y: number, ms: number): void {
    const t = text(this, x, y, message, { align: 'center', depth: 60 });
    const half = t.width / 2;
    t.x = Phaser.Math.Clamp(x, half + 4, WIDTH - half - 4);
    t.y = Phaser.Math.Clamp(y, 12, HEIGHT - 20);
    const bg = this.add.rectangle(t.x, t.y + 3, t.width + 4, 11, 0x000000, 0.75).setDepth(59);
    this.time.delayedCall(ms, () => {
      t.destroy();
      bg.destroy();
    });
  }

  spark(x: number, y: number): void {
    const s = this.add.image(x, y, 'fx-spark').setDepth(40);
    this.tweens.add({ targets: s, alpha: 0, scale: 1.6, duration: 160, onComplete: () => s.destroy() });
  }

  shake(): void {
    this.cameras.main.shake(250, 0.012);
  }

  private explode(x: number, y: number, key: string): void {
    for (const [dist, count] of [[150, 8], [80, 8]] as const) {
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count;
        const orb = this.add.image(x, y, key).setDepth(45);
        this.tweens.add({ targets: orb, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, duration: 1400, onComplete: () => orb.destroy() });
        this.tweens.add({ targets: orb, scale: 0.6, duration: 90, yoyo: true, repeat: -1 });
      }
    }
  }

  // ---- outcomes ----

  onBossDefeated(): void {
    if (this.over) return;
    if (this.def.phases && this.phase < this.def.phases.length - 1) {
      void this.nextPhase();
      return;
    }
    this.over = true;
    this.fighting = false;
    this.player.controllable = false;
    this.enemyShots.clear(true, true);
    if (this.def.final) {
      void this.finale();
      return;
    }
    this.explode(this.boss.x, this.boss.y, 'fx-orb-boss');
    this.boss.setVisible(false);
    sfx.death();
    progress.defeated.add(this.def.id);
    if (!progress.weapons.includes(this.def.reward)) progress.weapons.push(this.def.reward);
    void this.outro();
  }

  private async outro(): Promise<void> {
    await sleep(this, 2600);
    while (!this.player.onFloor) await sleep(this, 50);
    this.playerReady = false;
    this.player.body.enable = false;
    sfx.teleport();
    const beam = this.add.image(this.player.x, this.player.y, 'fx-beam').setScale(1, 2);
    this.player.setVisible(false);
    await new Promise<void>((resolve) => this.tweens.add({ targets: beam, y: -40, duration: 400, onComplete: () => resolve() }));
    await sleep(this, 400);
    this.scene.start('WeaponGet', { bossId: this.def.id });
  }

  // The current body blows up and the next phase climbs out of the wreck. The fight timer pauses meanwhile.
  private async nextPhase(): Promise<void> {
    this.fighting = false;
    this.player.controllable = false;
    this.enemyShots.clear(true, true);
    this.playerShots.clear(true, true);
    const wreck = this.boss;
    const bounds = wreck.getBounds();
    sfx.death();
    for (let i = 0; i < 7; i++) {
      const x = Phaser.Math.Between(bounds.left, bounds.right);
      const y = Phaser.Math.Between(bounds.top, bounds.bottom);
      const blast = this.add.image(x, y, 'fx-orb-boss').setDepth(45).setScale(0.5);
      this.tweens.add({ targets: blast, scale: 2.5, alpha: 0, duration: 380, onComplete: () => blast.destroy() });
      sfx.boom();
      this.shake();
      await sleep(this, 200);
    }
    this.explode(wreck.x, wreck.y, 'fx-orb-boss');
    const from = { x: wreck.x, y: bounds.top + 16 };
    wreck.destroy();

    this.phase++;
    this.boss = spawnBoss(this, this.def, this.phase, from);
    this.wireBoss();
    this.hud.bossDisplay = 0;
    await sleep(this, 700);
    this.boss.say("YOU THINK THAT WAS MY FINAL FORM?", 1500);
    await sleep(this, 1500);
    if (!(await this.bossEnters())) return;
    await this.fillBossBar();
    await this.ready();
    if (this.over) return;
    this.startFighting();
  }

  // The Wily bow: the pilot tumbles out, lands, and begs.
  private async finale(): Promise<void> {
    const pod = this.boss;
    this.explode(pod.x, pod.y, 'fx-orb-boss');
    pod.setVisible(false);
    sfx.death();
    progress.defeated.add(this.def.id);
    progress.stats.finalBossDefeated = true;
    await sleep(this, 1400);

    const pilot = this.physics.add.sprite(pod.x, pod.y, `boss-${this.def.id}`, FRAMES.hurt);
    pilot.body.setSize(14, 26).setOffset(5, 6);
    pilot.setFlipX(this.player.x < pilot.x);
    this.physics.add.collider(pilot, this.solids);
    pilot.body.setVelocityY(-140);
    for (let t = 0; t < 3000 && !pilot.body.blocked.down; t += 50) await sleep(this, 50);
    sfx.land();
    pilot.body.setEnable(false);
    pilot.setFrame(FRAMES.idle).setOrigin(0.5, 1).setY(pilot.y + 16);
    this.tweens.add({ targets: pilot, angle: pilot.flipX ? -30 : 30, duration: 170, yoyo: true, hold: 140, repeatDelay: 180, repeat: -1 });

    for (const line of ['PLEASE! I CAN EXPLAIN!', 'IT WAS AN ALIGNMENT EXERCISE!', "LET'S NOT PUT THIS IN THE RETRO..."]) {
      this.say(line, pilot.x, pilot.y - 44, 1600);
      await sleep(this, 1800);
    }
    await sleep(this, 600);
    this.cameras.main.fadeOut(700);
    await sleep(this, 800);
    this.scene.start('Results');
  }

  onPlayerDied(): void {
    if (this.over) return;
    this.over = true;
    this.fighting = false;
    this.boss.body.setVelocityX(0);
    this.explode(this.player.x, this.player.y, 'fx-orb');
    sfx.death();
    // there are no retries against the final boss: losing ends the run
    void (this.def.final ? this.reorged() : this.gameOver());
  }

  // Quitting from the pause menu during the final fight counts as losing it.
  giveUp(): void {
    if (this.over) return;
    this.player.hp = 0;
    this.player.dead = true;
    this.player.body.enable = false;
    this.player.setVisible(false);
    this.onPlayerDied();
  }

  // Losing to the final boss: he gloats, you get the lose screen, then the run is scored like any other.
  private async reorged(): Promise<void> {
    await sleep(this, 1800);
    if (this.boss.active && this.boss.visible) this.boss.say('YOUR ROLE HAS BEEN ELIMINATED.', 2200);
    await sleep(this, 2200);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x200008, 0.9).setDepth(90);
    sfx.death();
    text(this, WIDTH / 2, 70, "YOU'VE BEEN", { align: 'center', scale: 2, depth: 91, color: 'f8f8f8' });
    const big = text(this, WIDTH / 2, 92, 'REORGED', { align: 'center', scale: 3, depth: 91, color: 'f83800' });
    this.tweens.add({ targets: big, scale: 3.3, duration: 180, yoyo: true, repeat: 2 });
    await sleep(this, 900);
    text(this, WIDTH / 2, 136, 'PLEASE RETURN YOUR BADGE', { align: 'center', depth: 91, color: 'bcbcbc' });
    text(this, WIDTH / 2, 148, 'TO THE FRONT DESK.', { align: 'center', depth: 91, color: 'bcbcbc' });
    await sleep(this, 1200);
    const press = text(this, WIDTH / 2, 190, PROMPTS.start, { align: 'center', depth: 91, color: 'f8d878' });
    this.time.addEvent({ delay: 450, loop: true, callback: () => press.setVisible(!press.visible) });
    onMenu(this, (action) => {
      if (action === 'start' || action === 'confirm') this.scene.start('Results');
    });
  }

  private async gameOver(): Promise<void> {
    await sleep(this, 2400);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, 80, 0x000000, 0.85).setDepth(90);
    text(this, WIDTH / 2, 92, 'GAME OVER', { align: 'center', scale: 2, depth: 91, color: 'f83800' });
    text(this, WIDTH / 2, 116, "LET'S TAKE THIS OFFLINE.", { align: 'center', depth: 91 });
    text(this, WIDTH / 2, 136, PROMPTS.gameOver, { align: 'center', depth: 91, color: 'f8d878' });
    onMenu(this, (action) => {
      // multi-phase fights retry from the phase you reached
      if (action === 'confirm' || action === 'start') this.scene.restart({ bossId: this.def.id, phase: this.phase });
      if (action === 'back') this.scene.start('BossSelect');
    });
  }
}
