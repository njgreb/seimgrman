import { FLOOR_Y } from '../config';
import type { BossDef } from '../data/types';
import type { Boss } from '../entities/Boss';

// Planning. Weak to TICKET SPLIT (reality breaks the roadmap into tickets).

async function pivot(b: Boss) {
  for (const y of [b.muzzle.y, FLOOR_Y - 8]) {
    b.face();
    await b.telegraph(b.enraged ? 200 : 320);
    b.say('PIVOT!', 500);
    b.fire({
      texture: 'e-arrow',
      y,
      vx: b.facing * 250,
      ax: -b.facing * 380,
      damage: 3,
      keepOffscreen: true,
      lifespan: 3500,
      update: (shot) => shot.setFlipX(shot.body.velocity.x < 0),
    });
    await b.wait(450);
  }
}

async function quarterlyPlan(b: Boss) {
  b.face();
  b.say('Q1 Q2 Q3 Q4');
  await b.telegraph(400);
  const xs = [48, 96, 144, 192, 240].map((x) => x - 12 + (Math.random() * 16 - 8));
  const order = xs.sort(() => Math.random() - 0.5).slice(0, b.enraged ? 5 : 4);
  order.forEach((x, i) =>
    b.fire(
      {
        texture: 'e-milestone',
        x,
        y: 24,
        damage: 3,
        update: (shot) => {
          if (shot.age > 700 + i * 260 && !shot.mem.dropped) {
            shot.mem.dropped = true;
            shot.body.setVelocityY(260);
          }
        },
      },
      i === 0,
    ),
  );
  await b.wait(700 + order.length * 260 + 300);
}

async function reorg(b: Boss) {
  b.say('REORG!');
  await b.wait(300);
  await b.teleport(b.randomX(80));
  const base = b.angleToPlayer();
  for (const spread of b.enraged ? [-30, -10, 10, 30] : [-20, 0, 20]) {
    b.fire({ texture: 'e-milestone', ...b.velocity(base + spread, 140), damage: 3 }, spread === 0);
  }
  await b.wait(500);
}

export const roadmapMan: BossDef = {
  id: 'roadmap',
  name: 'ANDY MAN',
  manager: 'ANDY',
  intro: 'THIS IS A TOP PRIORITY. ALSO THIS.',
  defeatQuote: "WE'LL REVISIT NEXT QUARTER.",
  credit: 'HAS 11 TOP PRIORITIES',
  look: {
    skin: 'e0ac69',
    hair: '909090',
    hairStyle: 'bald',
    facialHair: 'beard',
    shirt: 'bcbcbc',
    pants: '0000bc',
    accent: 'a80020',
    accessories: ['mug'],
  },
  theme: { bg: '203000', pattern: '385000', tile: '007800', tileLight: '58d854' },
  weakness: 'ticket',
  reward: 'pivot',
  layout: [
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..###....###..#',
    '#..............#',
    '#..............#',
    '#..............#',
    '################',
    '################',
  ],
  patterns: [pivot, quarterlyPlan, reorg],
};
