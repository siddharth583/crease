import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mergeMatches } from '../engine/backup.ts';
import { DEFAULT_TEAMS, renameSides, renameTeam, TEAMS_REVISION } from '../engine/squad.ts';
import type { Match, Team } from '../engine/types.ts';

// Everything lives on the phone (grounds often have no signal). Match files and backups move it between phones.
const MATCHES_KEY = 'crease.matches.v1';
const TEAMS_KEY = 'crease.teams.v1';
const TEAMS_REVISION_KEY = 'crease.teamsRevision.v1';
/** Left behind by the club sync that used to be here; cleared on start. */
const OLD_KEYS = ['crease.club.v1', 'crease.dirty.v1'];

type Store = {
  ready: boolean;
  matches: Match[];
  savedTeams: Team[];
  saveMatch: (match: Match) => void;
  deleteMatch: (id: string) => void;
  rememberTeams: (teams: Team[]) => void;
  importMatches: (matches: Match[], teams: Team[]) => { added: number; updated: number; unchanged: number };
};

const MatchesContext = createContext<Store | null>(null);

export const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);

/**
 * Reads a saved value. `writable` says whether it's safe to save over it later: a value that can't be read is first
 * copied aside (under `<key>.unreadable.<time>`) so saving again never loses it; when storage can't be reached at all,
 * or the copy can't be made, nothing is saved over it this session.
 */
async function load<T>(key: string, fallback: T, valid: (v: unknown) => boolean): Promise<{ value: T; writable: boolean }> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return { value: fallback, writable: false };
  }
  if (!raw) return { value: fallback, writable: true };
  try {
    const value = JSON.parse(raw);
    if (valid(value)) return { value: value as T, writable: true };
  } catch {
    // Falls through to keeping a copy.
  }
  try {
    await AsyncStorage.setItem(`${key}.unreadable.${Date.now()}`, raw);
    return { value: fallback, writable: true };
  } catch {
    return { value: fallback, writable: false };
  }
}

const byNewest = (a: Match, b: Match) => b.createdAt - a.createdAt;
const teamName = (t: Team) => t.name.trim().toLowerCase();

/** A squad is remembered by name; the incoming copy replaces an older one with the same name. */
function mergeTeams(existing: Team[], incoming: Team[]) {
  const names = new Set(incoming.map(teamName));
  return [...incoming, ...existing.filter((t) => !names.has(teamName(t)))].slice(0, 50);
}

export function MatchesProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [savedTeams, setSavedTeams] = useState<Team[]>([]);
  const latest = useRef(matches);
  // Whether each saved list may be saved over: not when it couldn't be read and couldn't be kept aside.
  const writable = useRef({ matches: false, teams: false });
  latest.current = matches;

  useEffect(() => {
    Promise.all([
      load<Match[]>(MATCHES_KEY, [], Array.isArray),
      load<Team[]>(TEAMS_KEY, [], Array.isArray),
      load<number>(TEAMS_REVISION_KEY, 1, (v) => typeof v === 'number'),
    ]).then(([loadedMatches, loadedTeams, loadedRevision]) => {
      writable.current = { matches: loadedMatches.writable, teams: loadedTeams.writable };
      const revision = loadedRevision.value;
      // Copan A and B became Copan Strikers and Copan Royals in revision 3: the matches already played follow.
      const m = revision < 3 ? loadedMatches.value.map(renameSides) : loadedMatches.value;
      const t = revision < 3 ? loadedTeams.value.map(renameTeam) : loadedTeams.value;
      setMatches(m);
      // A phone with no saved teams (a new phone, or a new web address) starts with the club's two usual sides; one
      // that has them gets the new line-ups of those two once, when the sides change. Other saved teams stay.
      if (!t.length) setSavedTeams(DEFAULT_TEAMS);
      else if (revision < TEAMS_REVISION) setSavedTeams(mergeTeams(t, DEFAULT_TEAMS));
      else setSavedTeams(t);
      if (revision < TEAMS_REVISION) AsyncStorage.setItem(TEAMS_REVISION_KEY, JSON.stringify(TEAMS_REVISION)).catch(() => {});
      setReady(true);
    });
    AsyncStorage.multiRemove(OLD_KEYS).catch(() => {});
  }, []);

  const persist = (key: string, value: unknown, ok: boolean) => {
    if (ready && ok) AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  };
  useEffect(() => persist(MATCHES_KEY, matches, writable.current.matches), [ready, matches]);
  useEffect(() => persist(TEAMS_KEY, savedTeams, writable.current.teams), [ready, savedTeams]);

  const saveMatch = useCallback((match: Match) => {
    const saved = { ...match, updatedAt: Date.now() };
    setMatches((all) => [saved, ...all.filter((m) => m.id !== match.id)].sort(byNewest));
  }, []);

  const deleteMatch = useCallback((id: string) => {
    setMatches((all) => all.filter((m) => m.id !== id));
  }, []);

  const rememberTeams = useCallback((teams: Team[]) => {
    setSavedTeams((all) => mergeTeams(all, teams));
  }, []);

  const importMatches = useCallback((files: Match[], fileTeams: Team[]) => {
    // A file from a phone that still has the old names comes in under the new ones.
    const incoming = files.map(renameSides);
    const teams = fileTeams.map(renameTeam);
    const result = mergeMatches(latest.current, incoming);
    // Merged against whatever is there when it lands, so two imports in a row both count.
    if (result.changed.length) setMatches((all) => mergeMatches(all, incoming).matches);
    // A file's sides only join the saved teams under new names: your own line-ups (captain, keeper) stay as they are.
    if (teams.length) setSavedTeams((all) => [...all, ...teams.filter((t) => !all.some((x) => teamName(x) === teamName(t)))].slice(0, 50));
    return { added: result.added, updated: result.updated, unchanged: result.unchanged };
  }, []);

  const value = useMemo<Store>(
    () => ({ ready, matches, savedTeams, saveMatch, deleteMatch, rememberTeams, importMatches }),
    [ready, matches, savedTeams, saveMatch, deleteMatch, rememberTeams, importMatches],
  );
  return <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>;
}

export function useMatches() {
  const store = useContext(MatchesContext);
  if (!store) throw new Error('useMatches must be used inside MatchesProvider');
  return store;
}

export function useMatch(id: string | undefined) {
  const { matches, saveMatch, ready } = useMatches();
  return { match: matches.find((m) => m.id === id), saveMatch, ready };
}
