import Phaser from 'phaser';
import { WIDTH } from '../config';
import { COCKPIT, MACHINE_H, MACHINE_W } from '../art/generate';
import { sfx } from '../audio/sfx';
import type { BossDef } from '../data/types';
import type { Arena } from '../scenes/Arena';
import { Boss } from './Boss';
import type { Shot } from './Shot';

const TAUNTS = ['ANY QUESTIONS?', 'PER MY LAST EMAIL...', 'SYNERGY!', "LET'S TAKE A BEAT.", 'QUICK FOLLOW-UP:', "I'LL KEEP THIS BRIEF."];
const SHUTTER_LIFT = COCKPIT.h - 2;

// CTO MAN phase 1: THE ALL-HANDS MACHINE, a stationary mech parked on the right. Armor deflects everything;
// only the cockpit takes damage, and only while its shutter is up between attacks. The cockpit sits at
// jump-shot height, and shots flying at that height pass through the open air in front of it.
const COCKPIT_PAD = 4; // px of forgiveness around the dome
export class AllHandsMachine extends Boss {
  private open = false;
  private lift = 0;
  private taunt = 0;
  private readonly shutter: Phaser.GameObjects.Image;

  constructor(arena: Arena, def: BossDef) {
    super(arena, WIDTH - 16 - MACHINE_W / 2, -MACHINE_H, def);
    this.setTexture('cto-machine').setFlipX(false);
    this.facing = -1;
    this.body.setSize(MACHINE_W - 12, MACHINE_H - 2).setOffset(6, 2);
    this.body.setMaxVelocityY(600);
    this.shutter = arena.add.image(0, 0, 'cto-shutter');
    this.syncShutter();
  }

  get muzzle(): { x: number; y: number } {
    return { x: this.x - MACHINE_W / 2, y: this.y + 2 };
  }

  private get cockpit(): Phaser.Geom.Rectangle {
    const left = this.x - MACHINE_W / 2 + COCKPIT.x;
    const top = this.y - MACHINE_H / 2 + COCKPIT.y;
    return new Phaser.Geom.Rectangle(left - COCKPIT_PAD, top - COCKPIT_PAD, COCKPIT.w + COCKPIT_PAD * 2, COCKPIT.h + COCKPIT_PAD * 2);
  }

  private inCockpit(shot: Shot): boolean {
    return this.cockpit.contains(shot.x, shot.y);
  }

  // Above the body's top edge there's only the dome; everywhere else up there is empty air.
  private aboveArmor(shot: Shot): boolean {
    return shot.y < this.cockpit.bottom;
  }

  face(): void {
    this.facing = -1; // bolted to the floor, always facing the player's side
  }

  say(message: string, ms = 900): void {
    this.arena.say(message, this.x - 12, this.y - MACHINE_H / 2 - 10, ms);
  }

  countsAsLanded(shot: Shot): boolean {
    return this.inCockpit(shot);
  }

  takeHit(shot: Shot): boolean {
    if (this.inCockpit(shot)) {
      if (this.open) return super.takeHit(shot);
      this.deflect(shot);
      return false;
    }
    if (!this.aboveArmor(shot)) this.deflect(shot); // armor; otherwise it's still flying toward the dome
    return false;
  }

  async enter(): Promise<void> {
    await this.waitUntil(() => this.onFloor, 8000);
    sfx.boom();
    this.arena.shake();
    await this.wait(400);
    await this.setOpen(true);
    this.say("I'VE GOT 15 MINUTES. LET'S USE THEM.", 1400);
    await this.wait(1400);
    await this.setOpen(false);
  }

  protected async afterPattern(): Promise<void> {
    await this.setOpen(true);
    this.say(TAUNTS[this.taunt++ % TAUNTS.length], 800);
    await this.wait(this.enraged ? 1300 : 1700);
    await this.setOpen(false);
  }

  private async setOpen(open: boolean): Promise<void> {
    if (!open) this.open = false;
    sfx.whoosh();
    await new Promise<void>((resolve) =>
      this.arena.tweens.add({ targets: this, lift: open ? SHUTTER_LIFT : 0, duration: 220, onComplete: () => resolve() }),
    );
    this.guard();
    if (open) this.open = true;
  }

  private syncShutter(): void {
    const top = this.y - MACHINE_H / 2 + COCKPIT.y;
    this.shutter.setPosition(this.x - MACHINE_W / 2 + COCKPIT.x + COCKPIT.w / 2, top + (COCKPIT.h - 4) / 2 - this.lift);
    this.shutter.setVisible(this.visible).setAlpha(this.alpha).setDepth(this.depth + 1);
  }

  protected animate(): void {
    this.syncShutter();
  }

  setVisible(value: boolean): this {
    super.setVisible(value);
    this.shutter?.setVisible(value);
    return this;
  }

  destroy(fromScene?: boolean): void {
    this.shutter?.destroy();
    super.destroy(fromScene);
  }
}
