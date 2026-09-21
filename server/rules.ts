import { type RunStats, initialsAllowed } from '../src/score.ts';

// Everything a submission must pass. The game runs in the browser, so none of this stops a determined
// cheater; it stops casual tampering and obviously impossible runs.

const MIN_FIGHT_MS = 20_000; // four bosses can't be beaten faster than this
const MAX_FIGHT_MS = 24 * 60 * 60 * 1000;
const MIN_SHOTS_LANDED = 20; // each boss needs several landed volleys, even with its weakness weapon
const MAX_COUNT = 100_000;

export interface Submission {
  initials: string;
  stats: RunStats;
  build: string | null;
}

const isCount = (n: unknown, max = MAX_COUNT): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max;

// Returns the cleaned-up submission, or an error message for the player.
export function validate(body: unknown): Submission | string {
  if (!body || typeof body !== 'object') return 'bad request';
  const { initials, stats, build } = body as Record<string, unknown>;
  if (typeof initials !== 'string' || !initialsAllowed(initials)) return 'initials not allowed';
  if (!stats || typeof stats !== 'object') return 'missing stats';
  const { fightMs, shots, shotsLanded, hitsTaken, finalBossDefeated = false } = stats as Record<string, unknown>;
  if (typeof fightMs !== 'number' || !Number.isFinite(fightMs) || fightMs < MIN_FIGHT_MS || fightMs > MAX_FIGHT_MS) return 'impossible run';
  if (!isCount(shots) || !isCount(shotsLanded) || !isCount(hitsTaken)) return 'impossible run';
  if (shotsLanded > shots || shotsLanded < MIN_SHOTS_LANDED) return 'impossible run';
  if (typeof finalBossDefeated !== 'boolean') return 'bad request';
  return {
    initials,
    stats: { fightMs, shots, shotsLanded, hitsTaken, finalBossDefeated },
    build: typeof build === 'string' ? build.slice(0, 40) : null,
  };
}

// Discord notification events (POST /events). Purely informational, so this is lenient where the score
// rules are strict — a run that ends in a loss still gets announced — but every number and string that
// reaches the webhook is clamped here.
export interface GameEvent {
  type: 'load' | 'complete';
  stats: RunStats | null;
  managersBeaten: string[];
  finalBoss: string; // the roster lives in the game, so it names its own final boss
  finalBossManager: string;
  practice: boolean;
  build: string | null;
}

const clamp = (n: unknown, max = MAX_COUNT): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : 0;

const NAME_PATTERN = /^[A-Z0-9 .'-]{1,24}$/;
const isName = (n: unknown): n is string => typeof n === 'string' && NAME_PATTERN.test(n);

export function validateEvent(body: unknown): GameEvent | string {
  if (!body || typeof body !== 'object') return 'bad request';
  const { type, stats, managersBeaten, finalBoss, finalBossManager, practice, build } = body as Record<string, unknown>;
  if (type !== 'load' && type !== 'complete') return 'unknown event';
  const event: GameEvent = {
    type,
    stats: null,
    managersBeaten: Array.isArray(managersBeaten) ? managersBeaten.filter(isName).slice(0, 8) : [],
    finalBoss: isName(finalBoss) ? finalBoss : 'THE FINAL BOSS',
    finalBossManager: isName(finalBossManager) ? finalBossManager : 'the CTO',
    practice: practice === true,
    build: typeof build === 'string' ? build.slice(0, 40) : null,
  };
  if (type === 'complete') {
    if (!stats || typeof stats !== 'object') return 'missing stats';
    const { fightMs, shots, shotsLanded, hitsTaken, finalBossDefeated } = stats as Record<string, unknown>;
    event.stats = {
      fightMs: clamp(fightMs, MAX_FIGHT_MS),
      shots: clamp(shots),
      shotsLanded: Math.min(clamp(shotsLanded), clamp(shots)),
      hitsTaken: clamp(hitsTaken),
      finalBossDefeated: finalBossDefeated === true,
    };
  }
  return event;
}

// A few submissions per minute per network is plenty for humans. Raise RATE_LIMIT_PER_MIN if a whole
// office shares one IP. Discord pings get their own, looser budget (a room full of people opening the
// game at once is normal; a refresh loop is not).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MIN) || 10;
export const EVENTS_PER_MIN = Number(process.env.EVENT_RATE_LIMIT_PER_MIN) || 20;
const recent = new Map<string, number[]>();

export function rateLimited(key: string, max = MAX_PER_WINDOW, now = Date.now()): boolean {
  const times = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  const limited = times.length >= max;
  if (!limited) times.push(now);
  recent.set(key, times);
  if (recent.size > 10_000) for (const [k, v] of recent) if (v.every((t) => now - t >= WINDOW_MS)) recent.delete(k);
  return limited;
}
