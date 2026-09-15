import Phaser from 'phaser';
import { WIDTH } from '../config';
import { sfx } from '../audio/sfx';
import { FINAL_BOSS } from '../data/bosses';
import { PROMPTS, onMenu } from '../input';
import { type Entry, fetchTop } from '../leaderboard';
import { formatNumber, formatTime } from '../score';
import { starfield, text } from '../ui/text';

// 'attract': the title screen's idle loop; any button (or a few seconds) goes back to the title.
// 'after': right after entering initials, with the new entry highlighted; START rolls the credits.
interface LeaderboardData {
  mode: 'attract' | 'after';
  entry?: Entry;
  scores?: Entry[];
}

const ATTRACT_MS = 9000;
const TOP_Y = 58;
const ROW_H = 13;
const COLS = { rank: 34, name: 72, score: 170, time: 234 };

const ordinal = (n: number): string => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'}`;
};

export class Leaderboard extends Phaser.Scene {
  constructor() {
    super('Leaderboard');
  }

  create(data: LeaderboardData): void {
    const mode = data.mode ?? 'attract';
    this.cameras.main.setBackgroundColor('#000020');
    starfield(this, 50, 20);
    text(this, WIDTH / 2, 14, 'HIGH SCORES', { align: 'center', scale: 2, color: '3cbcfc' });
    const header = { color: '787878' };
    text(this, COLS.rank, 40, 'RANK', { ...header, align: 'right' });
    text(this, COLS.name, 40, 'NAME', header);
    text(this, COLS.score, 40, 'SCORE', { ...header, align: 'right' });
    text(this, COLS.time, 40, 'TIME', { ...header, align: 'right' });

    const leave = () => this.scene.start(mode === 'after' ? 'Ending' : 'Title');
    onMenu(this, (action) => {
      if (mode === 'attract' || action === 'start' || action === 'confirm') {
        if (mode === 'after') sfx.select();
        leave();
      }
    });
    if (mode === 'attract') this.time.delayedCall(ATTRACT_MS, leave);

    text(this, WIDTH - 16, 214, `* BEAT ${FINAL_BOSS.name}`, { align: 'right', color: '787878' });
    const press = text(this, WIDTH / 2, 226, PROMPTS.start, { align: 'center', color: 'f8f8f8' });
    this.time.addEvent({ delay: 450, loop: true, callback: () => press.setVisible(!press.visible) });

    if (data.scores) {
      this.render(data.scores, data.entry);
      return;
    }
    const loading = text(this, WIDTH / 2, 110, 'LOADING...', { align: 'center', color: 'bcbcbc' });
    fetchTop()
      .then((scores) => {
        if (!this.sys.isActive()) return;
        loading.destroy();
        this.render(scores);
      })
      .catch((err) => {
        console.warn('leaderboard fetch failed', err);
        if (!this.sys.isActive()) return;
        if (mode === 'attract') leave();
        else loading.setText("COULDN'T LOAD SCORES.");
      });
  }

  private render(scores: Entry[], mine?: Entry): void {
    if (scores.length === 0) {
      text(this, WIDTH / 2, 110, 'NO SCORES YET.', { align: 'center', color: 'f8f8f8' });
      text(this, WIDTH / 2, 124, 'BE THE FIRST!', { align: 'center', color: 'f8d878' });
      return;
    }
    const rowTexts = (entry: Entry, y: number, color: string) => [
      text(this, COLS.rank, y, ordinal(entry.rank), { align: 'right', color }),
      text(this, COLS.name, y, entry.finalBossDefeated ? `${entry.initials} *` : entry.initials, { color }),
      text(this, COLS.score, y, formatNumber(entry.total), { align: 'right', color }),
      text(this, COLS.time, y, formatTime(entry.fightMs), { align: 'right', color }),
    ];
    const blink = (texts: Phaser.GameObjects.BitmapText[]) =>
      this.tweens.add({ targets: texts, alpha: 0.25, duration: 220, yoyo: true, repeat: -1 });

    scores.forEach((entry, i) => {
      const isMine = entry.id === mine?.id;
      const podium = ['f8d878', 'f8f8f8', 'fca044'][i] ?? 'bcbcbc';
      const texts = rowTexts(entry, TOP_Y + i * ROW_H, isMine ? 'b8f818' : podium);
      if (isMine) blink(texts);
    });

    // made the board but not the top 10: show where you landed
    if (mine && !scores.some((e) => e.id === mine.id)) {
      this.add.graphics().fillStyle(0x787878).fillRect(16, TOP_Y + 10 * ROW_H + 2, WIDTH - 32, 1);
      blink(rowTexts(mine, TOP_Y + 10 * ROW_H + 8, 'b8f818'));
    }
  }
}
