import type { RunStats } from './score';

// Client for the leaderboard server (server/). The whole feature switches on when the build sets
// VITE_LEADERBOARD_URL; without it the game skips name entry and the title screen's high score loop.

const BASE = (import.meta.env.VITE_LEADERBOARD_URL as string | undefined)?.replace(/\/$/, '');
const TIMEOUT_MS = 6000;

export const LEADERBOARD_ENABLED = !!BASE;

export interface Entry {
  id: number;
  rank: number;
  initials: string;
  total: number;
  fightMs: number;
  accuracy: number;
  hitsTaken: number;
}

export class LeaderboardError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new LeaderboardError(res.status, body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export async function fetchTop(): Promise<Entry[]> {
  return (await request<{ scores: Entry[] }>('/scores?limit=10')).scores;
}

export function submitScore(initials: string, stats: RunStats): Promise<{ entry: Entry; scores: Entry[] }> {
  return request('/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initials, stats, build: import.meta.env.VITE_BUILD_SHA ?? 'dev' }),
  });
}

const INITIALS_KEY = 'mega-manager-initials';

// Pre-fill the last initials used on this device. Storage can be unavailable (private mode), so never required.
export function lastInitials(): string | null {
  try {
    return localStorage.getItem(INITIALS_KEY);
  } catch {
    return null;
  }
}

export function rememberInitials(initials: string): void {
  try {
    localStorage.setItem(INITIALS_KEY, initials);
  } catch {
    // fine
  }
}
