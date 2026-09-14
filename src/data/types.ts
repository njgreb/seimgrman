import type { Look } from '../art/characters';
import type { Boss } from '../entities/Boss';
import type { Shot } from '../entities/Shot';

export type BossPattern = (boss: Boss) => Promise<void>;

export interface BossDef {
  id: string; // matches art/raw/<id>/ and public/assets/bosses/<id>/
  name: string; // shown in-game, e.g. "DAVE MAN"
  manager: string; // real name, shown in the ending credits
  intro: string; // taunt on the intro screen (keep lines <= 38 chars)
  defeatQuote: string;
  credit: string; // one-liner in the ending credits
  look: Look;
  theme: { bg: string; pattern: string; tile: string; tileLight: string };
  weakness: string; // weapon id that deals WEAKNESS_DAMAGE
  reward: string; // weapon id awarded on defeat
  hp?: number;
  layout?: string[]; // 15 rows x 16 cols, '#' = solid. Defaults to a flat room.
  patterns: BossPattern[];
}

export interface ShotSpec {
  texture: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  ax?: number;
  ay?: number;
  gravity?: boolean;
  damage: number;
  pierce?: boolean; // player shots: keep flying after hitting the boss
  lifespan?: number;
  weapon?: string; // player shots: which weapon fired it
  effect?: 'freeze';
  keepOffscreen?: boolean;
  update?: (shot: Shot, delta: number) => void;
}

export interface WeaponDef {
  id: string;
  name: string;
  short: string; // 4-char label for the HUD
  description: string;
  colors: [string, string]; // player suit, trim
  cost: number; // energy per shot (of 28)
  damage: number;
  fire: (ctx: FireContext) => boolean; // returns false if nothing was fired
}

export interface FireContext {
  x: number;
  y: number;
  facing: 1 | -1;
  onFloor: boolean;
  playerX: () => number;
  count: (weaponId: string) => number;
  spawn: (spec: Omit<ShotSpec, 'weapon'>) => Shot;
}
