import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_TEAMS } from '../engine/squad.ts';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { mergeMatches } from '../engine/backup.ts';
import type { Match, Team } from '../engine/types.ts';
import * as cloud from './cloud.ts';

// Everything lives on the device first (grounds often have no signal). In a club, changes are also pushed to the
// club's shared store and other phones' changes are pulled in, so squads and player stats follow you to any phone.
const MATCHES_KEY = 'crease.matches.v1';
const TEAMS_KEY = 'crease.teams.v1';
const CLUB_KEY = 'crease.club.v1';
const DIRTY_KEY = 'crease.dirty.v1';

const EPOCH = '1970-01-01T00:00:00Z';
const PULL_EVERY_MS = 15_000;

/** Local changes not yet in the club's store. */
type Dirty = { matches: Record<string, 'upsert' | 'delete'>; teams: Record<string, true> };
type ClubState = cloud.Club & { since: string };
export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'error';

type Store = {
  ready: boolean;
  matches: Match[];
  savedTeams: Team[];
  saveMatch: (match: Match) => void;
  deleteMatch: (id: string) => void;
  rememberTeams: (teams: Team[]) => void;
  importMatches: (matches: Match[], teams: Team[]) => { added: number; updated: number; unchanged: number };
  club: cloud.Club | null;
  sync: { status: SyncStatus; lastSynced: number | null; pending: number; error: string | null };
  joinClub: (club: cloud.Club) => void;
  leaveClub: () => void;
  syncNow: () => void;
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
  const [club, setClub] = useState<ClubState | null>(null);
  const [dirty, setDirty] = useState<Dirty>({ matches: {}, teams: {} });
  const [status, setStatus] = useState<SyncStatus>('off');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The sync loop runs outside React's render, so it reads the latest state through refs.
  const latest = useRef({ matches, savedTeams, club, dirty });
  latest.current = { matches, savedTeams, club, dirty };
  const inFlight = useRef(false);
  const again = useRef(false);

  useEffect(() => {
    Promise.all([
      load<Match[]>(MATCHES_KEY, []),
      load<Team[]>(TEAMS_KEY, []),
      load<ClubState | null>(CLUB_KEY, null),
      load<Dirty>(DIRTY_KEY, { matches: {}, teams: {} }),
    ]).then(([m, t, c, d]) => {
      setMatches(m);
      // A phone with no saved teams (a new phone, or a new web address) starts with the club's two usual sides.
      setSavedTeams(t.length ? t : DEFAULT_TEAMS);
      setClub(c);
      setDirty(d);
      setReady(true);
    });
  }, []);

  const persist = (key: string, value: unknown) => {
    if (ready) AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  };
  useEffect(() => persist(MATCHES_KEY, matches), [ready, matches]);
  useEffect(() => persist(TEAMS_KEY, savedTeams), [ready, savedTeams]);
  useEffect(() => persist(CLUB_KEY, club), [ready, club]);
  useEffect(() => persist(DIRTY_KEY, dirty), [ready, dirty]);

  const syncNow = useCallback(async () => {
    const start = latest.current;
    if (!start.club || !cloud.cloudConfigured) return;
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    setStatus('syncing');
    const code = start.club.code;

    try {
      // 1. Send what changed here. Remember exactly what was sent, so an edit made meanwhile stays dirty.
      const sentMatches = new Map<string, Match | 'delete'>();
      const payload: cloud.RemoteMatch[] = [];
      for (const [id, kind] of Object.entries(start.dirty.matches)) {
        if (kind === 'delete') {
          sentMatches.set(id, 'delete');
          payload.push({ id, data: {} as Match, deleted: true });
        } else {
          const m = start.matches.find((x) => x.id === id);
          if (!m) continue;
          sentMatches.set(id, m);
          payload.push({ id, data: m, deleted: false });
        }
      }
      const sentTeams = start.savedTeams.filter((t) => start.dirty.teams[t.id]);
      if (payload.length || sentTeams.length) await cloud.push(code, payload, sentTeams);

      setDirty((d) => {
        const next: Dirty = { matches: { ...d.matches }, teams: { ...d.teams } };
        const now = latest.current;
        for (const [id, sent] of sentMatches) {
          const current = sent === 'delete' ? 'delete' : now.matches.find((x) => x.id === id);
          if (current === sent) delete next.matches[id];
        }
        for (const t of sentTeams) if (now.savedTeams.find((x) => x.id === t.id) === t) delete next.teams[t.id];
        return next;
      });

      // 2. Take in what other phones changed. A small overlap covers writes that landed while we last pulled.
      const since = new Date(new Date(start.club.since).getTime() - 60_000).toISOString();
      const pulled = await cloud.pull(code, since);
      if (!pulled) throw new Error('This club no longer exists.');

      const pending = latest.current.dirty.matches;
      if (pulled.matches.length) {
        setMatches((all) => {
          const map = new Map(all.map((m) => [m.id, m]));
          for (const r of pulled.matches) {
            if (pending[r.id]) continue; // our own unsent edit wins until it's sent
            if (r.deleted) map.delete(r.id);
            else map.set(r.id, r.data);
          }
          return [...map.values()].sort(byNewest);
        });
      }
      if (pulled.teams.length) setSavedTeams((all) => mergeTeams(all, pulled.teams));

      setClub((c) => (c && c.code === code ? { ...c, since: pulled.now } : c));
      setStatus('synced');
      setLastSynced(Date.now());
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // fetch rejects with a TypeError when there's no connection at all.
      setStatus(e instanceof TypeError ? 'offline' : 'error');
      setError(message);
    } finally {
      inFlight.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(syncNow, 300);
      }
    }
  }, []);

  // Pull on a timer and whenever the app comes back to the front; push shortly after each local change.
  useEffect(() => {
    if (!ready || !club?.code) {
      setStatus('off');
      return;
    }
    syncNow();
    const timer = setInterval(syncNow, PULL_EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && syncNow());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [ready, club?.code, syncNow]);

  const pendingCount = Object.keys(dirty.matches).length + Object.keys(dirty.teams).length;
  useEffect(() => {
    if (!ready || !club || pendingCount === 0) return;
    const t = setTimeout(syncNow, 800);
    return () => clearTimeout(t);
  }, [ready, club, dirty, pendingCount, syncNow]);

  const saveMatch = useCallback((match: Match) => {
    setMatches((all) => [match, ...all.filter((m) => m.id !== match.id)].sort(byNewest));
    setDirty((d) => ({ ...d, matches: { ...d.matches, [match.id]: 'upsert' } }));
  }, []);

  const deleteMatch = useCallback((id: string) => {
    setMatches((all) => all.filter((m) => m.id !== id));
    setDirty((d) => ({ ...d, matches: { ...d.matches, [id]: 'delete' } }));
  }, []);

  const rememberTeams = useCallback((teams: Team[]) => {
    setSavedTeams((all) => mergeTeams(all, teams));
    setDirty((d) => ({ ...d, teams: { ...d.teams, ...Object.fromEntries(teams.map((t) => [t.id, true as const])) } }));
  }, []);

  // Imported matches count as local changes, so in a club they're shared with everyone too.
  const importMatches = useCallback((incoming: Match[], teams: Team[]) => {
    const result = mergeMatches(latest.current.matches, incoming);
    if (result.changed.length) {
      setMatches(result.matches);
      setDirty((d) => ({
        ...d,
        matches: { ...d.matches, ...Object.fromEntries(result.changed.map((m) => [m.id, 'upsert' as const])) },
      }));
    }
    if (teams.length) rememberTeams(teams);
    return { added: result.added, updated: result.updated, unchanged: result.unchanged };
  }, [rememberTeams]);

  // Joining brings this phone's games and squads into the club, then pulls everyone else's.
  const joinClub = useCallback((c: cloud.Club) => {
    const { matches: m, savedTeams: t } = latest.current;
    setDirty({
      matches: Object.fromEntries(m.map((x) => [x.id, 'upsert' as const])),
      teams: Object.fromEntries(t.map((x) => [x.id, true as const])),
    });
    setLastSynced(null);
    setClub({ code: c.code, name: c.name, since: EPOCH });
  }, []);

  // Leaving keeps everything on this phone; it just stops syncing.
  const leaveClub = useCallback(() => {
    setClub(null);
    setDirty({ matches: {}, teams: {} });
    setLastSynced(null);
    setError(null);
  }, []);

  const value = useMemo<Store>(
    () => ({
      ready,
      matches,
      savedTeams,
      saveMatch,
      deleteMatch,
      rememberTeams,
      importMatches,
      club: club ? { code: club.code, name: club.name } : null,
      sync: { status, lastSynced, pending: pendingCount, error },
      joinClub,
      leaveClub,
      syncNow,
    }),
    [ready, matches, savedTeams, saveMatch, deleteMatch, rememberTeams, importMatches, club, status, lastSynced, pendingCount, error, joinClub, leaveClub, syncNow],
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
