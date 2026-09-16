import type { Look } from '../art/characters';
import { BUSTER_SPEED, FLOOR_Y, MAX_BUSTER_SHOTS } from '../config';
import type { WeaponDef } from './types';

export const PLAYER_LOOK: Look = {
  skin: 'ffdbac',
  hair: '1c1410',
  hairStyle: 'helmet',
  shirt: '0078f8',
  pants: '0058f8',
  shoes: '0000bc',
  accent: '3cbcfc',
};

const list: WeaponDef[] = [
  {
    id: 'buster',
    name: 'PR BUSTER',
    short: 'P',
    description: 'SHIPS SMALL CHANGES. FAST.',
    colors: ['0078f8', '3cbcfc'],
    cost: 0,
    damage: 1,
    fire: (c) => {
      if (c.count('buster') >= MAX_BUSTER_SHOTS) return false;
      c.spawn({ texture: 'shot-buster', x: c.x, y: c.y, vx: BUSTER_SPEED * c.facing, damage: 1 });
      return true;
    },
  },
  {
    id: 'calendar',
    name: 'CALENDAR BLOCK',
    short: 'C',
    description: 'BLOCKS OFF TIME IN 3 DIRECTIONS.',
    colors: ['e40058', 'f8f8f8'],
    cost: 2,
    damage: 2,
    fire: (c) => {
      if (c.count('calendar') > 0) return false;
      for (const vy of [-70, 0, 70]) c.spawn({ texture: 'shot-calendar', x: c.x, y: c.y, vx: 240 * c.facing, vy, damage: 2 });
      return true;
    },
  },
  {
    id: 'ticket',
    name: 'TICKET SPLIT',
    short: 'T',
    description: 'BREAKS DOWN INTO SUBTASKS.',
    colors: ['0058f8', 'f8f8f8'],
    cost: 2,
    damage: 2,
    fire: (c) => {
      if (c.count('ticket') > 1) return false;
      const facing = c.facing;
      c.spawn({
        texture: 'shot-ticket',
        x: c.x,
        y: c.y,
        vx: 240 * facing,
        damage: 2,
        update: (shot) => {
          if (shot.age < 180 || shot.mem.split) return;
          shot.mem.split = true;
          for (const vy of [-160, 0, 160]) c.spawn({ texture: 'shot-ticket', x: shot.x, y: shot.y, vx: 220 * facing, vy, damage: 2 });
          shot.destroy();
        },
      });
      return true;
    },
  },
  {
    id: 'pivot',
    name: 'PIVOT BOOMERANG',
    short: 'B',
    description: 'GOES OUT. COMES BACK. PIERCES.',
    colors: ['e45c10', 'fca044'],
    cost: 2,
    damage: 2,
    fire: (c) => {
      if (c.count('pivot') > 0) return false;
      c.spawn({
        texture: 'shot-pivot',
        x: c.x,
        y: c.y,
        vx: 280 * c.facing,
        ax: -520 * c.facing,
        damage: 2,
        pierce: true,
        lifespan: 2400,
        keepOffscreen: true,
        update: (shot, delta) => {
          shot.angle += delta * 0.9;
          const returning = Math.sign(shot.body.velocity.x) === -c.facing;
          if (returning && Math.abs(shot.x - c.playerX()) < 10) shot.destroy();
        },
      });
      return true;
    },
  },
  {
    id: 'pager',
    name: 'ESCALATION WAVE',
    short: 'W',
    description: 'GOES STRAIGHT TO THE TOP.',
    colors: ['a81000', 'f8b800'],
    cost: 3,
    damage: 3,
    fire: (c) => {
      if (c.count('pager') > 0) return false;
      const floorY = FLOOR_Y - 7;
      c.spawn({
        texture: 'shot-pager',
        x: c.x,
        y: c.onFloor ? floorY : c.y,
        vx: 170 * c.facing,
        gravity: !c.onFloor,
        damage: 3,
        pierce: true,
        update: (shot) => {
          if (shot.y >= floorY) {
            shot.y = floorY;
            shot.body.setAllowGravity(false).setVelocityY(0);
          }
        },
      });
      return true;
    },
  },
];

export const WEAPONS: Record<string, WeaponDef> = Object.fromEntries(list.map((w) => [w.id, w]));
export const WEAPON_ORDER = list.map((w) => w.id);
