import Phaser from 'phaser';
import { GAME_TITLE, WIDTH } from '../config';
import { FRAMES } from '../art/characters';
import { sfx } from '../audio/sfx';
import { BOSSES } from '../data/bosses';
import { PROMPTS, controlsHelp, onDeviceChange, onMenu } from '../input';
import { progress } from '../state';
import { starfield, text } from '../ui/text';

export class Title extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    progress.reset();
    this.cameras.main.setBackgroundColor('#000020');
    starfield(this, 50, 20);

    text(this, WIDTH / 2, 18, GAME_TITLE, { align: 'center', scale: 3, color: '3cbcfc' });
    text(this, WIDTH / 2, 48, 'AN ENGINEERING ONSITE ADVENTURE', { align: 'center', color: 'a4e4fc' });

    // the lineup
    const shown = BOSSES.slice(0, 4);
    const spacing = 44;
    const startX = WIDTH / 2 - ((shown.length - 1) * spacing) / 2 - spacing / 2;
    shown.forEach((b, i) => {
      const x = startX + i * spacing + (i >= shown.length / 2 ? spacing : 0);
      this.add.sprite(x, 94, `boss-${b.id}`, FRAMES.attack).setScale(1.5).setFlipX(i >= shown.length / 2);
    });
    const hero = this.add.sprite(WIDTH / 2, 94, 'player-buster', FRAMES.idle).setScale(2);
    this.time.addEvent({ delay: 900, loop: true, callback: () => hero.setFrame(hero.frame.name === String(FRAMES.shoot) ? FRAMES.idle : FRAMES.shoot) });

    const press = text(this, WIDTH / 2, 134, PROMPTS.start, { align: 'center', color: 'f8d878' });
    this.time.addEvent({ delay: 450, loop: true, callback: () => press.setVisible(!press.visible) });

    let help: Phaser.GameObjects.BitmapText[] = [];
    const showHelp = () => {
      help.forEach((t) => t.destroy());
      help = controlsHelp().map((line, i) => text(this, WIDTH / 2, 164 + i * 11, line, { align: 'center', color: 'bcbcbc' }));
      press.setText(PROMPTS.start);
    };
    showHelp();
    onDeviceChange(this, showHelp);

    onMenu(this, (action) => {
      if (action === 'start' || action === 'confirm') {
        sfx.select();
        this.scene.start('BossSelect');
      }
    });
  }
}
