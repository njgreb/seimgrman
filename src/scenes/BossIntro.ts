import Phaser from 'phaser';
import { WIDTH } from '../config';
import { FRAMES } from '../art/characters';
import { sfx } from '../audio/sfx';
import { bossById } from '../data/bosses';
import type { BossDef } from '../data/types';
import { onMenu } from '../input';
import { bigPortrait } from '../remaster';
import { sleep, starfield, text, typeOut } from '../ui/text';

export class BossIntro extends Phaser.Scene {
  private def!: BossDef;
  private leaving = false;

  constructor() {
    super('BossIntro');
  }

  init(data: { bossId: string }): void {
    this.def = bossById(data.bossId);
    this.leaving = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    const band = this.add.rectangle(WIDTH / 2, 100, WIDTH, 112, this.def.final ? 0xa80020 : 0x0000bc).setDepth(-2);
    if (this.def.final) {
      // the final boss gets alarms instead of a calm blue card
      const warning = text(this, WIDTH / 2, 20, 'WARNING', { align: 'center', scale: 2, color: 'f8d878' });
      this.time.addEvent({
        delay: 240,
        loop: true,
        callback: () => {
          const on = band.fillColor === 0xa80020;
          band.setFillStyle(on ? 0x500010 : 0xa80020);
          warning.setVisible(!on);
          if (!on) sfx.beep();
        },
      });
    }
    starfield(this, 30, 120, { y: 46, h: 108 });
    void this.sequence();
    this.time.delayedCall(600, () => onMenu(this, (a) => (a === 'confirm' || a === 'start') && this.go()));
  }

  private async sequence(): Promise<void> {
    const { def } = this;
    sfx.jingle();

    const portrait = bigPortrait(this, -60, 100, def.id);
    this.tweens.add({ targets: portrait, x: 72, duration: 350, ease: 'Cubic.easeOut' });

    const sprite = this.add.sprite(184, -40, `boss-${def.id}`, FRAMES.jump).setScale(3).setFlipX(true);
    await new Promise<void>((resolve) =>
      this.tweens.add({ targets: sprite, y: 104, duration: 500, ease: 'Quad.easeIn', onComplete: () => resolve() }),
    );
    sfx.land();
    sprite.setFrame(FRAMES.attack);

    const nameScale = def.name.length * 12 <= WIDTH - 16 ? 2 : 1;
    const name = text(this, WIDTH / 2, 168, '', { align: 'center', scale: nameScale, color: 'f8f8f8' });
    await typeOut(this, name, def.name, 70, sfx.tick);
    const quote = text(this, WIDTH / 2, 196, '', { align: 'center', color: 'a4e4fc' });
    await typeOut(this, quote, `"${def.intro}"`, 30);
    sprite.setFrame(FRAMES.idle);
    await sleep(this, 1600);
    this.go();
  }

  private go(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('Arena', { bossId: this.def.id });
  }
}
