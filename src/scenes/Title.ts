import Phaser from 'phaser';
import { GAME_TITLE, WIDTH } from '../config';
import { FRAMES } from '../art/characters';
import { sfx } from '../audio/sfx';
import { BOSSES } from '../data/bosses';
import { PROMPTS, controlsHelp, onDeviceChange, onMenu, usingButtons } from '../input';
import { LEADERBOARD_ENABLED } from '../leaderboard';
import { notifyStarted } from '../notify';
import { remaster } from '../remaster';
import { progress } from '../state';
import { starfield, text } from '../ui/text';

const IDLE_MS = 10_000;

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

    // 16-BIT REMASTER toggle (R on keyboards, SELECT on touch and controllers)
    const badge = text(this, WIDTH / 2, 147, 'NOW IN 16-BIT!', { align: 'center', color: 'f83800' });
    this.tweens.add({ targets: badge, scale: 1.15, duration: 300, yoyo: true, repeat: -1 });
    const toggleLine = text(this, WIDTH / 2, 226, '', { align: 'center' });
    const showRemaster = () => {
      badge.setVisible(remaster.enabled);
      const label = `${usingButtons() ? 'SELECT' : 'R'}: 16-BIT REMASTER ${remaster.enabled ? 'ON' : 'OFF'}`;
      toggleLine.setText(label).setTint(remaster.enabled ? 0xf8d878 : 0x787878);
    };
    const toggleRemaster = () => {
      remaster.toggle();
      if (remaster.enabled) sfx.jingle();
      else sfx.cursor();
      showRemaster();
    };
    this.input.keyboard!.on('keydown-R', toggleRemaster);

    let help: Phaser.GameObjects.BitmapText[] = [];
    const showHelp = () => {
      help.forEach((t) => t.destroy());
      help = controlsHelp().map((line, i) => text(this, WIDTH / 2, 164 + i * 11, line, { align: 'center', color: 'bcbcbc' }));
      press.setText(PROMPTS.start);
      showRemaster();
    };
    showHelp();
    onDeviceChange(this, showHelp);

    // Sit idle and the high scores take a turn, like an arcade cabinet.
    let idle: Phaser.Time.TimerEvent | undefined;
    const resetIdle = () => {
      idle?.remove();
      if (LEADERBOARD_ENABLED) idle = this.time.delayedCall(IDLE_MS, () => this.scene.start('Leaderboard', { mode: 'attract' }));
    };
    resetIdle();
    this.input.keyboard!.on('keydown', resetIdle);

    onMenu(this, (action) => {
      resetIdle();
      if (action === 'select') toggleRemaster();
      if (action === 'start' || action === 'confirm') {
        sfx.select();
        notifyStarted();
        this.scene.start('BossSelect');
      }
    });
  }
}
