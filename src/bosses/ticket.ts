import { FLOOR_Y, GRAVITY, TILE, WIDTH } from '../config';
import type { BossDef } from '../data/types';
import type { Boss } from '../entities/Boss';
import { clamp } from './util';

// Jira. Weak to CALENDAR BLOCK (time-boxing kills the backlog).

async function backlogToss(b: Boss) {
  b.face();
  await b.telegraph(250);
  for (let i = 0; i < (b.enraged ? 3 : 2); i++) {
    b.face();
    const m = b.muzzle;
    const vy = -280;
    // time to fall back down to the floor from the muzzle
    const drop = FLOOR_Y - 6 - m.y;
    const t = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * drop)) / GRAVITY;
    const targetX = clamp(b.player.x, TILE + 8, WIDTH - TILE - 8);
    b.fire({
      texture: 'e-ticket',
      vx: (targetX - m.x) / t,
      vy,
      gravity: true,
      damage: 3,
      update: (shot) => {
        shot.angle += 12;
        if (shot.body.velocity.y <= 0 || shot.y < FLOOR_Y - 6) return;
        for (const dir of [-1, 1]) {
          b.arena.spawnEnemyShot({ texture: 'e-ticket-small', x: shot.x, y: FLOOR_Y - 4, vx: dir * 120, damage: 2 });
        }
        shot.destroy();
      },
    });
    await b.wait(550);
  }
}

async function sprint(b: Boss) {
  b.face();
  b.say('SPRINT!');
  await b.telegraph(450);
  await b.dashTo(b.facing < 0 ? TILE : WIDTH - TILE, b.enraged ? 260 : 210);
  b.face();
  await b.wait(250);
}

async function scopeCreep(b: Boss) {
  b.face();
  b.say('SCOPE CREEP');
  await b.telegraph(350);
  b.fire({
    texture: 'e-ticket',
    vx: b.facing * 55,
    vy: 0,
    damage: 4,
    pierce: true,
    lifespan: 7000,
    update: (shot) => {
      shot.setScale(Math.min(3.5, 1 + shot.age / 900));
      shot.y = Math.min(shot.y, FLOOR_Y - shot.displayHeight / 2);
    },
  });
  await b.wait(700);
  if (b.enraged) await b.jumpTo(b.x + b.facing * 64, 56);
}

export const ticketMan: BossDef = {
  id: 'ticket',
  name: 'DANIEL MAN',
  manager: 'DANIEL',
  intro: 'IS THERE A TICKET FOR THAT?',
  defeatQuote: "MOVING YOU TO 'DONE'...",
  credit: 'ESTIMATES IN FIBONACCI ONLY',
  look: {
    skin: 'e0ac69',
    hair: '6a4e2e',
    hairStyle: 'buzz',
    facialHair: 'stubble',
    shirt: 'f8f8f8',
    pants: '004058',
    accent: '00a800',
    accessories: ['lanyard'],
  },
  theme: { bg: '002040', pattern: '004058', tile: '0058f8', tileLight: '3cbcfc' },
  weakness: 'calendar',
  reward: 'ticket',
  patterns: [backlogToss, sprint, scopeCreep],
};
