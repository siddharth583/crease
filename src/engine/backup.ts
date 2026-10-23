import { matchState } from './engine.ts';
import type { Match, Team } from './types.ts';

// A match file holds whole matches (every ball), never totals: the stats are worked out again from the balls on
// whichever phone imports it, so one file is enough to carry every player's and team's numbers.

export const BACKUP_APP = 'crease';
export const BACKUP_VERSION = 1;

export type Backup = {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  matches: Match[];
  teams: Team[];
};

export function makeBackup(matches: Match[], teams: Team[]): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), matches, teams };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);

export function backupFileName(matches: Match[], when = new Date(), ext: 'json' | 'pdf' = 'json') {
  const date = when.toISOString().slice(0, 10);
  if (matches.length === 1) {
    const [a, b] = matches[0].teams;
    return `crease-${slug(a.name)}-vs-${slug(b.name)}-${date}.${ext}`;
  }
  return `crease-${matches.length}-matches-${date}.${ext}`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function looksLikeTeam(t: unknown): t is Team {
  return isObject(t) && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.players);
}

function looksLikeMatch(m: unknown): m is Match {
  if (!isObject(m) || typeof m.id !== 'string' || typeof m.createdAt !== 'number') return false;
  if (!Array.isArray(m.teams) || m.teams.length !== 2 || !m.teams.every(looksLikeTeam)) return false;
  if (!Array.isArray(m.innings) || m.innings.length !== 2) return false;
  if (!m.innings.every((i) => isObject(i) && Array.isArray(i.events))) return false;
  try {
    matchState(m as Match); // the real test: can it be scored?
    return true;
  } catch {
    return false;
  }
}

/** Reads a match file. Throws an Error with a message fit to show the person. */
export function parseBackup(text: string): { matches: Match[]; teams: Team[]; skipped: number } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t a Crease match file.');
  }
  if (!isObject(data) || data.app !== BACKUP_APP || !Array.isArray(data.matches)) {
    throw new Error('That file isn’t a Crease match file.');
  }
  if (typeof data.version === 'number' && data.version > BACKUP_VERSION) {
    throw new Error('That file is from a newer version of Crease. Update the app and try again.');
  }
  const matches = data.matches.filter(looksLikeMatch);
  const teams = Array.isArray(data.teams) ? data.teams.filter(looksLikeTeam) : [];
  return { matches, teams, skipped: data.matches.length - matches.length };
}

const ballsIn = (m: Match) => m.innings.reduce((n, i) => n + i.events.length, 0);

/**
 * Adds imported matches to what's on the phone. The same match (same id) is only replaced by a copy that has got
 * further, so importing an old file never rolls a match back, and importing the same file twice changes nothing.
 */
export function mergeMatches(existing: Match[], incoming: Match[]) {
  const byId = new Map(existing.map((m) => [m.id, m]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const changed: Match[] = [];
  for (const m of incoming) {
    const mine = byId.get(m.id);
    if (!mine) {
      added++;
    } else if (ballsIn(m) > ballsIn(mine)) {
      updated++;
    } else {
      unchanged++;
      continue;
    }
    byId.set(m.id, m);
    changed.push(m);
  }
  const matches = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  return { matches, changed, added, updated, unchanged };
}
