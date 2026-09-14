import Phaser from 'phaser';
import { WIDTH } from '../config';
import { FRAMES } from '../art/characters';
import { sfx } from '../audio/sfx';
import { BOSSES, bossById } from '../data/bosses';
import { WEAPONS } from '../data/weapons';
import { onMenu } from '../input';
import { progress } from '../state';
import { sleep, starfield, text, typeOut } from '../ui/text';

export class WeaponGet extends Phaser.Scene {
  constructor() {
    super('WeaponGet');
  }

  create(data: { bossId: string }): void {
    const def = bossById(data.bossId);
    const weapon = WEAPONS[def.reward];
    this.cameras.main.setBackgroundColor('#000040');
    starfield(this, 40, 40);
    void this.sequence(def.name, def.defeatQuote, weapon.id, weapon.name, weapon.description);
  }

  private async sequence(bossName: string, quote: string, weaponId: string, weaponName: string, description: string): Promise<void> {
    text(this, WIDTH / 2, 20, `"${quote}"`, { align: 'center', color: 'bcbcbc' });
    text(this, WIDTH / 2, 32, `- ${bossName}`, { align: 'center', color: '787878' });

    const hero = this.add.sprite(WIDTH / 2, 92, 'player-buster', FRAMES.idle).setScale(3);
    sfx.jingle();
    for (let i = 0; i < 14; i++) {
      hero.setTexture(i % 2 ? 'player-buster' : `player-${weaponId}`, FRAMES.idle);
      await sleep(this, 90);
    }
    hero.setTexture(`player-${weaponId}`, FRAMES.shoot);

    const title = text(this, WIDTH / 2, 144, '', { align: 'center', scale: 2, color: 'f8d878' });
    await typeOut(this, title, 'WEAPON GET!', 50, sfx.tick);
    const name = text(this, WIDTH / 2, 170, '', { align: 'center', color: 'f8f8f8' });
    await typeOut(this, name, `YOU GOT ${weaponName}`, 35, sfx.tick);
    text(this, WIDTH / 2, 184, description, { align: 'center', color: 'a4e4fc' });

    await sleep(this, 400);
    const allDone = BOSSES.every((b) => progress.defeated.has(b.id));
    const press = text(this, WIDTH / 2, 214, 'PRESS ENTER', { align: 'center', color: 'f8d878' });
    this.time.addEvent({ delay: 450, loop: true, callback: () => press.setVisible(!press.visible) });
    onMenu(this, (action) => {
      if (action === 'start' || action === 'confirm') this.scene.start(allDone ? 'Ending' : 'BossSelect');
    });
  }
}
