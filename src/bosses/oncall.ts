import { FLOOR_Y, TILE, WIDTH } from '../config';
import type { BossDef } from '../data/types';
import type { Boss } from '../entities/Boss';
import { sfx } from '../audio/sfx';
import { between } from './util';

// The customer is always on the line. Weak to PIVOT BOOMERANG (nothing derails an ask like a pivot).

// Thrown in after an attack, so he always has one more thing.
const ASIDES = ['CAN WE GET THIS BY FRIDAY?', 'IS THIS A P0?', 'I ALREADY PROMISED IT.', 'THE CUSTOMER LOVED THE DEMO.', 'JUST ONE MORE THING:'];

async function quickAsk(b: Boss) {
  b.face();
  b.say('QUICK ASK!', 600);
  await b.telegraph(250);
  for (let i = 0; i < (b.enraged ? 5 : 3); i++) {
    b.face();
    b.fire({ texture: 'e-page', ...b.velocity(b.angleToPlayer(), 210), damage: 2 }, false);
    sfx.beep();
    await b.wait(150);
  }
  b.say(ASIDES[between(0, ASIDES.length - 1)], 900);
  await b.wait(500);
}

async function escalation(b: Boss) {
  b.say('ESCALATION!', 600);
  await b.telegraph(200);
  await b.jumpTo(b.player.x, 96);
  b.arena.shake();
  sfx.boom();
  for (const dir of [-1, 1]) {
    b.fire({ texture: 'e-shockwave', x: b.x + dir * 10, y: FLOOR_Y - 8, vx: dir * (b.enraged ? 180 : 140), damage: 4, pierce: true }, false);
  }
  await b.wait(500);
}

async function launchDay(b: Boss) {
  b.face();
  b.say('LAUNCH DAY!');
  await b.telegraph(300);
  const xs = [b.player.x, between(TILE * 2, WIDTH - TILE * 2), between(TILE * 2, WIDTH - TILE * 2)];
  if (b.enraged) xs.push(between(TILE * 2, WIDTH - TILE * 2));
  const warnings = xs.map((x) => b.arena.add.image(x, FLOOR_Y - 3, 'e-warning'));
  const blink = b.arena.tweens.add({ targets: warnings, alpha: 0.2, duration: 90, yoyo: true, repeat: -1 });
  await b.wait(750);
  blink.remove();
  warnings.forEach((w) => w.destroy());
  sfx.boom();
  for (const x of xs) {
    b.fire({ texture: 'e-flame', x, y: FLOOR_Y - 24, damage: 4, pierce: true, lifespan: 650, update: (s) => s.setFlipX(Math.floor(s.age / 80) % 2 === 0) }, false);
  }
  await b.wait(800);
}

export const oncallMan: BossDef = {
  id: 'oncall',
  name: 'BRENT MAN',
  manager: 'BRENT',
  intro: 'THE CUSTOMER IS ON THE LINE.',
  defeatQuote: "I'LL TAKE THIS AS FEEDBACK.",
  credit: 'HAS ONE QUICK ASK',
  look: {
    skin: 'e0ac69',
    hair: '909090',
    hairStyle: 'bald',
    facialHair: 'stubble',
    shirt: '5c6c8c',
    pants: '383838',
    accent: '00a844',
    accessories: ['lanyard'],
  },
  theme: { bg: '200020', pattern: '401040', tile: '6844fc', tileLight: 'b8b8f8' },
  weakness: 'pivot',
  reward: 'pager',
  patterns: [quickAsk, escalation, launchDay],
};
