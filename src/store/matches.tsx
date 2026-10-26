import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mergeMatches } from '../engine/backup.ts';
import { DEFAULT_TEAMS, TEAMS_REVISION } from '../engine/squad.ts';
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

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
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
  latest.current = matches;

  useEffect(() => {
    Promise.all([load<Match[]>(MATCHES_KEY, []), load<Team[]>(TEAMS_KEY, []), load<number>(TEAMS_REVISION_KEY, 1)]).then(([m, t, revision]) => {
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

  const persist = (key: string, value: unknown) => {
    if (ready) AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  };
  useEffect(() => persist(MATCHES_KEY, matches), [ready, matches]);
  useEffect(() => persist(TEAMS_KEY, savedTeams), [ready, savedTeams]);

  const saveMatch = useCallback((match: Match) => {
    setMatches((all) => [match, ...all.filter((m) => m.id !== match.id)].sort(byNewest));
  }, []);

  const deleteMatch = useCallback((id: string) => {
    setMatches((all) => all.filter((m) => m.id !== id));
  }, []);

  const rememberTeams = useCallback((teams: Team[]) => {
    setSavedTeams((all) => mergeTeams(all, teams));
  }, []);

  const importMatches = useCallback(
    (incoming: Match[], teams: Team[]) => {
      const result = mergeMatches(latest.current, incoming);
      if (result.changed.length) setMatches(result.matches);
      if (teams.length) rememberTeams(teams);
      return { added: result.added, updated: result.updated, unchanged: result.unchanged };
    },
    [rememberTeams],
  );

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
