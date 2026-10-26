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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "26 Oct 2026": the same on every phone, whatever its language. */
export const fileDate = (when: number | Date) => {
  const d = new Date(when);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** A name as people would write it, without the characters phones and computers refuse in file names. */
const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * What an exported file is called. One match: its teams and the day it was played, with the series and match number
 * when it's part of one ("Copan Cup - Match 3 - Copan A vs Copan B - 26 Oct 2026"). Several: how many, and when.
 */
export function backupFileName(matches: Match[], when = new Date(), ext: 'json' | 'pdf' = 'json') {
  if (matches.length === 1) {
    const m = matches[0];
    const [a, b] = m.teams;
    const series = m.series ? `${m.series.name} - Match ${m.series.number} - ` : '';
    return `${clean(`${series}${a.name} vs ${b.name} - ${fileDate(m.createdAt)}`)}.${ext}`;
  }
  const series = new Set(matches.map((m) => m.series?.id)).size === 1 ? matches[0].series?.name : undefined;
  return `${clean(`${series ?? 'Crease'} - ${matches.length} matches - ${fileDate(when)}`)}.${ext}`;
}

/** The record book, as a PDF to read or a file to load on another phone. */
export const recordBookFileName = (when = new Date(), ext: 'json' | 'pdf' = 'pdf') => `Crease Record Book - ${fileDate(when)}.${ext}`;

/** The result picture of a match. */
export const pictureFileName = (m: Match) => `${clean(`${m.teams[0].name} vs ${m.teams[1].name} - Result - ${fileDate(m.createdAt)}`)}.png`;

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
