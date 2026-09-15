import {
  SCORE_CLEAR_BONUS,
  SCORE_HIT_ALLOWANCE,
  SCORE_PER_ACCURACY_PCT,
  SCORE_PER_HIT_AVOIDED,
  SCORE_PER_SECOND_SAVED,
  SCORE_TIME_LIMIT_S,
} from './config.ts';

// Stats for one run. They add up across every fight, including lost attempts,
// so a retry costs time, shots and hits. Plain numbers, ready to send to a leaderboard.
export interface RunStats {
  fightMs: number; // time spent fighting (intros, menus and pause don't count)
  shots: number; // trigger pulls that fired something
  shotsLanded: number; // trigger pulls where at least one projectile touched the boss
  hitsTaken: number;
}

export interface ScoreBreakdown extends RunStats {
  accuracy: number; // 0..1
  timeBonus: number;
  accuracyBonus: number;
  hitBonus: number;
  clearBonus: number;
  total: number;
}

export const emptyStats = (): RunStats => ({ fightMs: 0, shots: 0, shotsLanded: 0, hitsTaken: 0 });

export function scoreRun(stats: RunStats): ScoreBreakdown {
  const accuracy = stats.shots ? stats.shotsLanded / stats.shots : 0;
  const timeBonus = Math.round(Math.max(0, SCORE_TIME_LIMIT_S - stats.fightMs / 1000) * SCORE_PER_SECOND_SAVED);
  const accuracyBonus = Math.round(accuracy * 100) * SCORE_PER_ACCURACY_PCT;
  const hitBonus = Math.max(0, SCORE_HIT_ALLOWANCE - stats.hitsTaken) * SCORE_PER_HIT_AVOIDED;
  const clearBonus = SCORE_CLEAR_BONUS;
  return { ...stats, accuracy, timeBonus, accuracyBonus, hitBonus, clearBonus, total: timeBonus + accuracyBonus + hitBonus + clearBonus };
}

const RANKS: [number, string][] = [
  [90_000, 'DISTINGUISHED ENGINEER'],
  [75_000, 'PRINCIPAL ENGINEER'],
  [60_000, 'STAFF ENGINEER'],
  [45_000, 'SENIOR ENGINEER'],
  [30_000, 'ENGINEER II'],
  [0, 'INTERN'],
];

export const rankFor = (total: number): string => RANKS.find(([min]) => total >= min)![1];

export const formatNumber = (n: number): string => Math.round(n).toLocaleString('en-US');

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Leaderboard initials: three letters, classic arcade style. Shared by the name entry screen and the server.
export const INITIALS_PATTERN = /^[A-Z]{3}$/;
const BLOCKED_INITIALS = new Set(['ASS', 'CUM', 'DIK', 'FAG', 'FCK', 'FUC', 'FUK', 'JIZ', 'KKK', 'NIG', 'SEX', 'SHT', 'TIT', 'WTF', 'CNT', 'DIC', 'FKU', 'POO', 'PEE']);
export const initialsAllowed = (initials: string): boolean => INITIALS_PATTERN.test(initials) && !BLOCKED_INITIALS.has(initials);
