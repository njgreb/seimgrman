import Phaser from 'phaser';
import { WIDTH } from '../config';
import { FRAMES } from '../art/characters';
import { sfx } from '../audio/sfx';
import { PROMPTS, onMenu } from '../input';
import { formatNumber, formatTime, rankFor, scoreRun } from '../score';
import { progress } from '../state';
import { sleep, starfield, text, typeOut } from '../ui/text';

// Arcade-style score tally after the last boss, before the credits. The only place the score is shown.
export class Results extends Phaser.Scene {
  private done = false;

  constructor() {
    super('Results');
  }

  create(): void {
    this.done = false;
    this.cameras.main.setBackgroundColor('#000020');
    starfield(this, 40, 15);
    onMenu(this, (a) => {
      if (this.done && (a === 'start' || a === 'confirm')) {
        sfx.select();
        this.scene.start('Ending');
      }
    });
    void this.tally();
  }

  private async tally(): Promise<void> {
    const score = scoreRun(progress.stats);

    const title = text(this, WIDTH / 2, 14, '', { align: 'center', scale: 2, color: 'f8d878' });
    await typeOut(this, title, 'PERFORMANCE REVIEW', 40, sfx.tick);
    text(this, WIDTH / 2, 34, 'ALL MANAGERS DEFEATED', { align: 'center', color: 'a4e4fc' });
    this.add.sprite(WIDTH / 2, 68, 'player-buster', FRAMES.shoot).setScale(1.5);
    await sleep(this, 400);

    const rows: [string, string, number][] = [
      ['FIGHT TIME', formatTime(score.fightMs), score.timeBonus],
      ['ACCURACY', `${Math.round(score.accuracy * 100)}%`, score.accuracyBonus],
      ['HITS TAKEN', String(score.hitsTaken), score.hitBonus],
      ['CLEAR BONUS', '', score.clearBonus],
    ];
    let y = 100;
    let running = 0;
    const total = text(this, WIDTH - 16, 170, '0', { align: 'right', scale: 2, color: 'f8f8f8' });
    text(this, 16, 174, 'SCORE', { color: 'f8d878' });

    for (const [label, value, points] of rows) {
      text(this, 16, y, label, { color: 'bcbcbc' });
      text(this, 150, y, value, { align: 'right', color: 'f8f8f8' });
      const pts = text(this, WIDTH - 16, y, '+0', { align: 'right', color: '3cbcfc' });
      await this.countUp(points, (n) => {
        pts.setText(`+${formatNumber(n)}`);
        total.setText(formatNumber(running + n));
      });
      running += points;
      y += 14;
      await sleep(this, 250);
    }
    const line = this.add.graphics().fillStyle(0x787878).fillRect(16, 162, WIDTH - 32, 1);
    line.setDepth(1);

    await sleep(this, 400);
    sfx.jingle();
    text(this, WIDTH / 2, 196, 'RATING', { align: 'center', color: '787878' });
    const rank = text(this, WIDTH / 2, 207, '', { align: 'center', color: 'f8d878' });
    await typeOut(this, rank, rankFor(score.total), 45, sfx.tick);

    await sleep(this, 600);
    const press = text(this, WIDTH / 2, 226, PROMPTS.start, { align: 'center', color: 'f8f8f8' });
    this.time.addEvent({ delay: 450, loop: true, callback: () => press.setVisible(!press.visible) });
    this.done = true;
  }

  private countUp(target: number, onStep: (n: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const steps = 20;
      let i = 0;
      this.time.addEvent({
        delay: 30,
        repeat: steps - 1,
        callback: () => {
          i++;
          onStep(Math.round((target * i) / steps));
          if (i % 2 === 0) sfx.tick();
          if (i >= steps) resolve();
        },
      });
    });
  }
}
