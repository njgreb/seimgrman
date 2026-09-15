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
  const { fightMs, shots, shotsLanded, hitsTaken } = stats as Record<string, unknown>;
  if (typeof fightMs !== 'number' || !Number.isFinite(fightMs) || fightMs < MIN_FIGHT_MS || fightMs > MAX_FIGHT_MS) return 'impossible run';
  if (!isCount(shots) || !isCount(shotsLanded) || !isCount(hitsTaken)) return 'impossible run';
  if (shotsLanded > shots || shotsLanded < MIN_SHOTS_LANDED) return 'impossible run';
  return {
    initials,
    stats: { fightMs, shots, shotsLanded, hitsTaken },
    build: typeof build === 'string' ? build.slice(0, 40) : null,
  };
}

// A few submissions per minute per network is plenty for humans. Raise RATE_LIMIT_PER_MIN if a whole
// office shares one IP.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MIN) || 10;
const recent = new Map<string, number[]>();

export function rateLimited(key: string, now = Date.now()): boolean {
  const times = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  const limited = times.length >= MAX_PER_WINDOW;
  if (!limited) times.push(now);
  recent.set(key, times);
  if (recent.size > 10_000) for (const [k, v] of recent) if (v.every((t) => now - t >= WINDOW_MS)) recent.delete(k);
  return limited;
}
