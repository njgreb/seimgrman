import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { sfx } from '../audio/sfx';
import { FINAL_BOSS } from '../data/bosses';
import { PROMPTS, onMenu } from '../input';
import { sleep, starfield, text, typeOut } from '../ui/text';

// The Wily castle moment: after the last manager, an emergency all-hands invite, a video call from the
// final boss, and HQ lit up with alarms. START skips straight to the fight.
export class Fortress extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super('Fortress');
  }

  create(): void {
    this.leaving = false;
    this.cameras.main.setBackgroundColor('#100008');
    starfield(this, 40, 10);
    this.time.delayedCall(600, () => onMenu(this, (a) => (a === 'start' || a === 'confirm') && this.go()));
    void this.sequence();
  }

  private async sequence(): Promise<void> {
    const boss = FINAL_BOSS;
    const act1 = this.add.container(0, 0);
    const add = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      act1.add(obj);
      return obj;
    };

    const heading = add(text(this, WIDTH / 2, 14, '', { align: 'center', color: 'a4e4fc' }));
    await typeOut(this, heading, 'ALL MANAGERS DEFEATED.', 35, sfx.tick);
    const sub = add(text(this, WIDTH / 2, 26, '', { align: 'center', color: 'bcbcbc' }));
    await typeOut(this, sub, 'THEN A CALENDAR INVITE ARRIVED...', 35);
    await sleep(this, 300);

    // the invite pops up
    const invite = add(this.add.container(WIDTH / 2, 70).setScale(0));
    invite.add([
      this.add.rectangle(0, 0, 184, 56, 0xf8f8f8).setStrokeStyle(2, 0x101010),
      this.add.rectangle(0, -21, 184, 14, 0xa80020),
      text(this, 0, -25, 'EMERGENCY ALL-HANDS', { align: 'center', color: 'f8f8f8' }),
      text(this, -86, -8, `ORGANIZER: ${boss.name}`, { color: '101010' }),
      text(this, -86, 3, 'WHERE: HQ    WHEN: NOW', { color: '101010' }),
      text(this, -86, 14, 'RSVP: MANDATORY', { color: 'a80020' }),
    ]);
    this.tweens.add({ targets: invite, scale: 1, duration: 220, ease: 'Back.easeOut' });
    for (let i = 0; i < 3; i++) {
      sfx.beep();
      await sleep(this, 180);
    }
    await sleep(this, 700);

    // he joins the call
    add(this.add.rectangle(56, 130, 54, 54, 0x000000).setStrokeStyle(2, 0xa80020));
    const portrait = add(this.add.image(56, 130, `portrait-${boss.id}`).setAlpha(0));
    this.tweens.add({ targets: portrait, alpha: 1, duration: 300 });
    add(text(this, 56, 160, boss.name, { align: 'center', color: 'f83800' }));
    sfx.teleport();
    await sleep(this, 400);
    const line1 = add(text(this, 94, 116, '', { color: 'f8f8f8' }));
    await typeOut(this, line1, `"WE'RE MAKING`, 45, sfx.tick);
    const line2 = add(text(this, 94, 128, '', { color: 'f8f8f8' }));
    await typeOut(this, line2, `SOME CHANGES."`, 45, sfx.tick);
    await sleep(this, 1400);

    // HQ, under alarms
    this.tweens.add({ targets: act1, alpha: 0, duration: 300 });
    await sleep(this, 350);
    act1.destroy();
    const alarm = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xa80020, 0).setDepth(-1);
    this.tweens.add({ targets: alarm, fillAlpha: 0.35, duration: 260, yoyo: true, repeat: -1 });
    const hq = this.add.image(WIDTH / 2, 120, 'fx-hq').setScale(1.5).setAlpha(0);
    this.tweens.add({ targets: hq, alpha: 1, y: 112, duration: 600 });
    text(this, WIDTH / 2, 14, 'HQ', { align: 'center', scale: 2, color: 'f8f8f8' });
    const warning = text(this, WIDTH / 2, 196, 'WARNING: REORG IN PROGRESS', { align: 'center', color: 'f8d878' });
    this.time.addEvent({ delay: 260, loop: true, callback: () => warning.setVisible(!warning.visible) });
    text(this, WIDTH / 2, 222, PROMPTS.start, { align: 'center', color: 'bcbcbc' });
    for (let i = 0; i < 6; i++) {
      sfx.beep();
      await sleep(this, 520);
    }
    this.go();
  }

  private go(): void {
    if (this.leaving) return;
    this.leaving = true;
    sfx.select();
    this.scene.start('BossIntro', { bossId: FINAL_BOSS.id });
  }
}
