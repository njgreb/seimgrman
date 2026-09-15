import Phaser from 'phaser';
import { GAME_TITLE, HEIGHT, WIDTH } from '../config';
import { FRAMES } from '../art/characters';
import { sfx } from '../audio/sfx';
import { BOSSES, FINAL_BOSS } from '../data/bosses';
import { PROMPTS, onMenu } from '../input';
import { remaster } from '../remaster';
import { progress } from '../state';
import { starfield, text } from '../ui/text';

export class Ending extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000020');
    starfield(this, 60, 25);
    sfx.jingle();

    const roll = this.add.container(0, HEIGHT);
    let y = 0;
    const line = (s: string, color = 'f8f8f8', scale = 1) => {
      roll.add(text(this, WIDTH / 2, y, s, { align: 'center', color, scale }));
      y += 10 * scale + 4;
    };
    const portrait = (id: string) => {
      const hd = `portrait16-${id}`;
      if (remaster.enabled && this.textures.exists(hd)) {
        roll.add(this.add.image(WIDTH / 2, y + 48, hd));
        y += 102;
      } else {
        roll.add(this.add.image(WIDTH / 2, y + 24, `portrait-${id}`));
        y += 54;
      }
    };

    line('ALL MANAGERS', 'f8d878', 2);
    line('DEFEATED!', 'f8d878', 2);
    y += 16;
    line(progress.stats.finalBossDefeated ? 'YOUR CALENDAR IS FINALLY FREE.' : 'THE REORG WENT AHEAD ANYWAY.', 'a4e4fc');
    y += 30;

    for (const boss of BOSSES) {
      portrait(boss.id);
      line(boss.name, 'f8f8f8');
      line(`AS PLAYED BY ${boss.manager}`, 'bcbcbc');
      line(boss.credit, '787878');
      y += 24;
    }

    line('AND INTRODUCING', 'f83800');
    y += 6;
    portrait(FINAL_BOSS.id);
    line(FINAL_BOSS.name, 'f8d878');
    line(`AS PLAYED BY ${FINAL_BOSS.manager}`, 'bcbcbc');
    line(FINAL_BOSS.credit, '787878');
    y += 24;

    y += 20;
    line(GAME_TITLE, '3cbcfc', 2);
    y += 10;
    line('THANKS FOR PLAYING!', 'f8f8f8');
    line('AND THANKS TO OUR MANAGERS,', 'f8f8f8');
    line('WHO ARE ACTUALLY PRETTY GREAT.', 'f8f8f8');
    y += 30;
    line('A CREATION OF ETS R&D', 'a4e4fc');
    y += 10;
    // 44 characters is wider than the 256px screen, so this one is split
    line('NO SEI TOKENS WERE SPENT', '787878');
    line('ON WHATEVER THIS IS.', '787878');
    y += 40;
    const endY = y;

    const hero = this.add.sprite(WIDTH / 2, HEIGHT - 40, 'player-buster', FRAMES.idle).setScale(2).setAlpha(0);

    this.tweens.add({
      targets: roll,
      y: HEIGHT / 2 - endY + 30,
      duration: (endY + HEIGHT / 2) * 28,
      onComplete: () => {
        this.tweens.add({ targets: hero, alpha: 1, duration: 600 });
        const press = text(this, WIDTH / 2, HEIGHT - 16, PROMPTS.start, { align: 'center', color: 'f8d878' });
        this.time.addEvent({ delay: 450, loop: true, callback: () => press.setVisible(!press.visible) });
      },
    });

    this.time.delayedCall(1500, () =>
      onMenu(this, (a) => {
        if (a === 'start') this.scene.start('Title');
        if (a === 'confirm') roll.y -= 40;
      }),
    );
  }
}
