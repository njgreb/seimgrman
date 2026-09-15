import { WIDTH } from '../config';
import type { BossDef } from '../data/types';
import type { Boss } from '../entities/Boss';
import { between, homing } from './util';

// Meetings. Weak to PAGER WAVE (nothing ends a meeting faster than a page).

async function inviteSpread(b: Boss) {
  b.face();
  await b.telegraph(300);
  const volleys = b.enraged ? 3 : 2;
  for (let v = 0; v < volleys; v++) {
    const base = b.angleToPlayer();
    for (const spread of [-22, 0, 22]) b.fire({ texture: 'e-invite', ...b.velocity(base + spread, 130), damage: 3 }, spread === 0);
    await b.wait(500);
  }
}

async function quickSync(b: Boss) {
  b.face();
  b.say('QUICK SYNC?');
  await b.telegraph(500);
  b.fire({
    texture: 'e-clock',
    ...b.velocity(b.angleToPlayer(), b.enraged ? 95 : 75),
    damage: 2,
    effect: 'freeze',
    lifespan: 5000,
    update: homing(() => b.player, 50),
  });
  await b.wait(900);
}

async function runningLong(b: Boss) {
  b.say('RUNNING LONG');
  await b.jumpTo(b.x < WIDTH / 2 ? WIDTH - 48 : 48, 80);
  b.face();
  for (let i = 0; i < (b.enraged ? 5 : 3); i++) {
    b.fire({ texture: 'e-invite', x: between(32, WIDTH - 32), y: -8, vy: 110, damage: 3 }, i === 0);
    await b.wait(220);
  }
  await b.wait(400);
}

export const syncMan: BossDef = {
  id: 'sync',
  name: 'PARKER MAN',
  manager: 'PARKER',
  intro: "LET'S CIRCLE BACK ON THAT.",
  defeatQuote: "LET'S... TAKE THIS OFFLINE.",
  credit: 'HAS NEVER DECLINED AN INVITE',
  look: {
    skin: 'f1c27d',
    hair: '6a4e2e',
    hairStyle: 'short',
    glasses: 'square',
    shirt: 'a87848',
    pants: '383838',
    accent: 'f8b800',
  },
  theme: { bg: '440018', pattern: '6a1030', tile: 'a81000', tileLight: 'f87858' },
  weakness: 'pager',
  reward: 'calendar',
  patterns: [inviteSpread, quickSync, runningLong],
};
