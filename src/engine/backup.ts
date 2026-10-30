import type { Auction } from './auction.ts';
import { matchState } from './engine.ts';
import type { SquadPlayer } from './squad.ts';
import type { Match, Team } from './types.ts';

// A match file holds whole matches (every ball), never totals: the stats are worked out again from the balls on
// whichever phone imports it, so one file is enough to carry every player's and team's numbers. A full backup also
// carries what the balls can't: the squad (roles, keepers, stars, who's the same person on either side) and the
// auctions. Those are extra fields, so older match files still import and older apps still read the matches.

export const BACKUP_APP = 'crease';
export const BACKUP_VERSION = 1;

export type Backup = {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  matches: Match[];
  teams: Team[];
  /** A full backup only. */
  squad?: SquadPlayer[];
  auctions?: Auction[];
};

export function makeBackup(matches: Match[], teams: Team[], extra?: { squad: SquadPlayer[]; auctions: Auction[] }): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), matches, teams, ...extra };
}

/** The full backup: everything on this phone in one file. */
export const fullBackupFileName = (when = new Date()) => `Crease Backup - ${fileDate(when)}.json`;

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
 * when it's part of one ("Copan Cup - Match 3 - Copan Strikers vs Copan Royals - 26 Oct 2026"). Several: how many, and when.
 */
export function backupFileName(matches: Match[], when = new Date(), ext: 'json' | 'pdf' | 'png' = 'json') {
  if (matches.length === 1) {
    const m = matches[0];
    const [a, b] = m.teams;
    const series = m.series ? `${m.series.name} - Match ${m.series.number} - ` : '';
    return `${clean(`${series}${a.name} vs ${b.name} - ${fileDate(m.createdAt)}`)}.${ext}`;
  }
  const series = new Set(matches.map((m) => m.series?.id)).size === 1 ? matches[0].series?.name : undefined;
  return `${clean(`${series ?? 'Crease'} - ${matches.length} matches - ${fileDate(when)}`)}.${ext}`;
}

/** The record book, as a PDF or picture to read, or a file to load on another phone. */
export const recordBookFileName = (when = new Date(), ext: 'json' | 'pdf' | 'png' = 'pdf') => `Crease Record Book - ${fileDate(when)}.${ext}`;

/** The result picture of a match. */
export const pictureFileName = (m: Match) => `${clean(`${m.teams[0].name} vs ${m.teams[1].name} - Result - ${fileDate(m.createdAt)}`)}.png`;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function looksLikeTeam(t: unknown): t is Team {
  return isObject(t) && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.players);
}

function looksLikeMatch(m: unknown): m is Match {
  if (!isObject(m) || typeof m.id !== 'string' || typeof m.createdAt !== 'number') return false;
  if (!Array.isArray(m.teams) || m.teams.length !== 2 || !m.teams.every(looksLikeTeam)) return false;
  // Two innings, or four once a tie went to a super over.
  if (!Array.isArray(m.innings) || (m.innings.length !== 2 && m.innings.length !== 4)) return false;
  if (!m.innings.every((i) => isObject(i) && Array.isArray(i.events))) return false;
  try {
    matchState(m as Match); // the real test: can it be scored?
    return true;
  } catch {
    return false;
  }
}

const isRating = (n: unknown) => typeof n === 'number' && n >= 1 && n <= 5;

function looksLikeSquadPlayer(p: unknown): p is SquadPlayer {
  return isObject(p) && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim() !== '' && typeof p.role === 'string' && isRating(p.bat) && isRating(p.bowl) && isRating(p.field);
}

function looksLikeAuction(a: unknown): a is Auction {
  return isObject(a) && typeof a.id === 'string' && typeof a.createdAt === 'number' && Array.isArray(a.sides) && Array.isArray(a.roster) && Array.isArray(a.events);
}

/** Reads a match file or a full backup. Throws an Error with a message fit to show the person. */
export function parseBackup(text: string): { matches: Match[]; teams: Team[]; skipped: number; squad: SquadPlayer[] | null; auctions: Auction[] } {
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
  const squad = Array.isArray(data.squad) ? data.squad.filter(looksLikeSquadPlayer) : null;
  const auctions = Array.isArray(data.auctions) ? data.auctions.filter(looksLikeAuction) : [];
  return { matches, teams, skipped: data.matches.length - matches.length, squad, auctions };
}

const nameOf = (p: { name: string }) => p.name.trim().toLowerCase();

/**
 * A backup's squad on top of the phone's: a player the file has (by name) takes the file's role, keeper and stars,
 * keeping this phone's id; players only the file has join; players only this phone has stay.
 */
export function mergeSquad(existing: SquadPlayer[], incoming: SquadPlayer[]) {
  const mine = new Map(existing.map((p) => [nameOf(p), p]));
  let added = 0;
  let updated = 0;
  const squad = existing.map((p) => {
    const theirs = incoming.find((x) => nameOf(x) === nameOf(p));
    if (!theirs) return p;
    const next = { ...theirs, id: p.id };
    if (JSON.stringify(next) !== JSON.stringify(p)) updated++;
    return next;
  });
  for (const p of incoming) {
    if (mine.has(nameOf(p))) continue;
    // A new player whose id this phone already uses for someone else gets one of their own.
    const id = squad.some((x) => x.id === p.id) ? `${p.id}-${squad.length + 1}` : p.id;
    squad.push({ ...p, id });
    mine.set(nameOf(p), p);
    added++;
  }
  return { squad, added, updated };
}

/** A backup's auctions join the phone's; one the phone already has (same id) is kept as it is. Newest first. */
export function mergeAuctions(existing: Auction[], incoming: Auction[]) {
  const have = new Set(existing.map((a) => a.id));
  const fresh = incoming.filter((a) => !have.has(a.id));
  return { auctions: [...existing, ...fresh].sort((a, b) => b.createdAt - a.createdAt), added: fresh.length };
}

const ballsIn = (m: Match) => m.innings.reduce((n, i) => n + i.events.length, 0);
const newer = (a: Match, b: Match) =>
  a.updatedAt !== undefined && b.updatedAt !== undefined ? a.updatedAt > b.updatedAt : ballsIn(a) > ballsIn(b) || (a.updatedAt ?? 0) > (b.updatedAt ?? 0);

/**
 * Adds imported matches to what's on the phone. The same match (same id) is only replaced by a newer copy: one saved
 * later (a fix, a picked Man of the Match, a changed target all count), or for copies from before saves were dated,
 * one that has got further. Importing an old file never rolls a match back, and importing a file twice changes nothing.
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
    } else if (newer(m, mine)) {
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
