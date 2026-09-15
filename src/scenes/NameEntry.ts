import Phaser from 'phaser';
import { WIDTH } from '../config';
import { sfx } from '../audio/sfx';
import { type Controls, PROMPTS, createControls, onMenu, usingButtons } from '../input';
import { lastInitials, rememberInitials, submitScore } from '../leaderboard';
import { formatNumber, initialsAllowed, scoreRun } from '../score';
import { progress } from '../state';
import { starfield, text } from '../ui/text';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SLOT_X = [WIDTH / 2 - 36, WIDTH / 2, WIDTH / 2 + 36];
const SLOT_Y = 96;
const REPEAT_DELAY_MS = 350;
const REPEAT_EVERY_MS = 85;

// Classic arcade initials: up/down picks a letter, A moves on, B goes back, START saves.
// Keyboards can also just type.
export class NameEntry extends Phaser.Scene {
  private letters: string[] = [];
  private slot = 0;
  private busy = false;
  private failed = false;
  private controls!: Controls;
  private slotTexts: Phaser.GameObjects.BitmapText[] = [];
  private cursor!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.BitmapText;
  private held: { dir: 1 | -1; since: number; last: number } | null = null;

  constructor() {
    super('NameEntry');
  }

  create(): void {
    this.busy = false;
    this.failed = false;
    this.slot = 0;
    this.held = null;
    const saved = lastInitials();
    this.letters = saved && /^[A-Z]{3}$/.test(saved) ? [...saved] : ['A', 'A', 'A'];

    this.cameras.main.setBackgroundColor('#000020');
    starfield(this, 40, 15);
    text(this, WIDTH / 2, 22, 'HIGH SCORE ENTRY', { align: 'center', scale: 2, color: 'f8d878' });
    text(this, WIDTH / 2, 48, `SCORE ${formatNumber(scoreRun(progress.stats).total)}`, { align: 'center', color: 'f8f8f8' });
    text(this, WIDTH / 2, 64, 'ENTER YOUR INITIALS', { align: 'center', color: 'a4e4fc' });

    this.slotTexts = SLOT_X.map((x) => text(this, x, SLOT_Y, 'A', { align: 'center', scale: 3, color: 'f8f8f8' }));
    this.cursor = this.add.graphics();
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.cursor.setVisible(this.busy || !this.cursor.visible) });

    const hints = usingButtons()
      ? ['UP / DOWN: LETTER   A: NEXT', 'B: BACK   START: SAVE']
      : ['TYPE, OR UP / DOWN: LETTER', 'BACKSPACE: BACK   ENTER: SAVE'];
    hints.forEach((h, i) => text(this, WIDTH / 2, 150 + i * 12, h, { align: 'center', color: '787878' }));
    this.status = text(this, WIDTH / 2, 192, '', { align: 'center', color: 'f8d878' });
    this.refresh();

    this.controls = createControls(this);
    onMenu(this, (action) => this.onAction(action), { keyboard: false });
    // Typing reads DOM key events directly: Phaser batches keys per frame, which can reorder fast typing.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !this.sys.isActive()) return;
      if (/^Key[A-Z]$/.test(e.code)) this.type(e.code.slice(3));
      else if (e.code === 'Backspace') this.onAction('back');
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') this.onAction('start');
      else if (e.code === 'ArrowUp') this.onAction('up');
      else if (e.code === 'ArrowDown') this.onAction('down');
      else if (e.code === 'ArrowLeft') this.onAction('left');
      else if (e.code === 'ArrowRight') this.onAction('right');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
  }

  update(time: number): void {
    this.controls.pressed.clear(); // only isDown is used here; presses arrive through onMenu
    // holding up/down scrolls through the alphabet
    const dir = this.controls.isDown('up') ? 1 : this.controls.isDown('down') ? -1 : 0;
    if (!dir || this.busy) {
      this.held = null;
      return;
    }
    if (this.held?.dir !== dir) {
      this.held = { dir, since: time, last: time }; // the press itself already moved one letter
      return;
    }
    if (time - this.held.since > REPEAT_DELAY_MS && time - this.held.last > REPEAT_EVERY_MS) {
      this.held.last = time;
      this.step(dir);
    }
  }

  private onAction(action: string): void {
    if (this.failed) {
      if (action === 'start' || action === 'confirm') this.scene.start('Ending');
      return;
    }
    if (this.busy) return;
    if (action === 'up') this.step(1);
    else if (action === 'down') this.step(-1);
    else if (action === 'left' || action === 'back') this.move(-1);
    else if (action === 'right') this.move(1);
    else if (action === 'confirm') this.slot === 2 ? void this.save() : this.move(1);
    else if (action === 'start') void this.save();
  }

  private type(letter: string): void {
    if (this.busy || this.failed) return;
    this.letters[this.slot] = letter;
    sfx.cursor();
    this.slot = Math.min(2, this.slot + 1);
    this.refresh();
  }

  private step(dir: 1 | -1): void {
    const i = LETTERS.indexOf(this.letters[this.slot]);
    this.letters[this.slot] = LETTERS[(i + dir + LETTERS.length) % LETTERS.length];
    sfx.cursor();
    this.refresh();
  }

  private move(dir: 1 | -1): void {
    const next = Phaser.Math.Clamp(this.slot + dir, 0, 2);
    if (next === this.slot) return;
    this.slot = next;
    sfx.tick();
    this.refresh();
  }

  private refresh(): void {
    this.slotTexts.forEach((t, i) => t.setText(this.letters[i]).setTint(i === this.slot ? 0xf8d878 : 0xf8f8f8));
    this.cursor.clear().fillStyle(0xf8d878).fillRect(SLOT_X[this.slot] - 10, SLOT_Y + 26, 20, 2);
  }

  private async save(): Promise<void> {
    const initials = this.letters.join('');
    if (!initialsAllowed(initials)) {
      sfx.deflect();
      this.status.setText('NICE TRY. PICK OTHER INITIALS.').setTint(0xf87858);
      return;
    }
    this.busy = true;
    sfx.select();
    this.status.setText('FILING PAPERWORK...').setTint(0xf8d878);
    try {
      const { entry, scores } = await submitScore(initials, progress.stats);
      rememberInitials(initials);
      this.scene.start('Leaderboard', { mode: 'after', entry, scores });
    } catch (err) {
      console.warn('leaderboard submit failed', err);
      this.busy = false;
      this.failed = true;
      this.status.setText("COULDN'T REACH THE LEADERBOARD.").setTint(0xf87858);
      text(this, WIDTH / 2, 212, PROMPTS.start, { align: 'center', color: 'f8f8f8' });
    }
  }
}
