import { File, Paths } from 'expo-file-system';
import { createContext, createElement, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import type { Auction } from '../engine/auction.ts';
import { mergeAuctions, mergeSquad } from '../engine/backup.ts';
import { DEFAULT_SQUAD, TEAMS_REVISION, updateSquad, type SquadPlayer } from '../engine/squad.ts';
import type { SavedLineup } from '../engine/teams.ts';
import { setRegulars } from '../engine/stats.ts';

// The squad, the auctions and the saved line-ups, kept on this phone. Read synchronously at start-up, like the preferences, so the
// regulars are known before any stats are worked out.

/** `revision`: which version of the usual sides the squad was last brought up to. */
type Saved = { squad: SquadPlayer[]; auctions: Auction[]; lineups?: SavedLineup[]; revision?: number };

const KEY = 'crease.squad.v1';
const fileFor = () => new File(Paths.document, 'crease-squad.json');

/** False when the saved squad couldn't be read or kept aside: nothing is saved over it this session. */
let writable = true;

function read(): Saved {
  let raw: string | null = null;
  try {
    raw =
      Platform.OS === 'web'
        ? typeof localStorage !== 'undefined'
          ? localStorage.getItem(KEY)
          : null
        : fileFor().exists
          ? fileFor().textSync()
          : null;
    const saved = raw ? (JSON.parse(raw) as Partial<Saved>) : {};
    // Squads saved before players had an auction category take the usual one for each regular.
    let squad = (saved.squad ?? DEFAULT_SQUAD).map((p) => (p.category ? p : { ...p, category: DEFAULT_SQUAD.find((d) => d.id === p.id)?.category }));
    // New sides since this phone last looked: rename and add the players they bring, once.
    if ((saved.revision ?? 1) < TEAMS_REVISION) {
      squad = updateSquad(squad);
      write({ squad, auctions: saved.auctions ?? [], lineups: saved.lineups ?? [], revision: TEAMS_REVISION });
    }
    return { squad, auctions: saved.auctions ?? [], lineups: saved.lineups ?? [], revision: TEAMS_REVISION };
  } catch {
    // An unreadable squad is kept aside before the defaults are ever saved over it.
    try {
      if (raw !== null) {
        if (Platform.OS === 'web') localStorage.setItem(`${KEY}.unreadable.${Date.now()}`, raw);
        else {
          const spare = new File(Paths.document, `crease-squad.unreadable.${Date.now()}.json`);
          spare.create();
          spare.writeSync(raw);
        }
      }
    } catch {
      writable = false;
    }
    return { squad: DEFAULT_SQUAD, auctions: [], revision: TEAMS_REVISION };
  }
}

function write(s: Saved) {
  if (!writable) return;
  try {
    const raw = JSON.stringify(s);
    if (Platform.OS === 'web') localStorage.setItem(KEY, raw);
    else {
      const f = fileFor();
      if (!f.exists) f.create();
      f.writeSync(raw);
    }
  } catch {
    // Kept in memory for this session; the next save tries again.
  }
}

const startup = read();
setRegulars(startup.squad.map((p) => p.name));

type SquadStore = {
  squad: SquadPlayer[];
  setSquad: (squad: SquadPlayer[]) => void;
  auctions: Auction[];
  saveAuction: (a: Auction) => void;
  deleteAuction: (id: string) => void;
  lineups: SavedLineup[];
  saveLineup: (l: SavedLineup) => void;
  deleteLineup: (id: string) => void;
  /** A full backup's squad, auctions and line-ups, merged in: how many players joined or changed, and what was added. */
  importSquad: (squad: SquadPlayer[] | null, auctions: Auction[], lineups?: SavedLineup[]) => { players: number; auctions: number; lineups: number };
};

const SquadContext = createContext<SquadStore | null>(null);

export function SquadProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState<Saved>(startup);
  const latest = useRef(state);
  latest.current = state;
  const update = useCallback((fn: (s: Saved) => Saved) => {
    set((s) => {
      const next = fn(s);
      write(next);
      if (next.squad !== s.squad) setRegulars(next.squad.map((p) => p.name));
      return next;
    });
  }, []);
  const setSquad = useCallback((squad: SquadPlayer[]) => update((s) => ({ ...s, squad })), [update]);
  const saveAuction = useCallback(
    (a: Auction) => update((s) => ({ ...s, auctions: [a, ...s.auctions.filter((x) => x.id !== a.id)].sort((x, y) => y.createdAt - x.createdAt) })),
    [update],
  );
  const deleteAuction = useCallback((id: string) => update((s) => ({ ...s, auctions: s.auctions.filter((x) => x.id !== id) })), [update]);
  const saveLineup = useCallback((l: SavedLineup) => update((s) => ({ ...s, lineups: [l, ...(s.lineups ?? []).filter((x) => x.id !== l.id)] })), [update]);
  const deleteLineup = useCallback((id: string) => update((s) => ({ ...s, lineups: (s.lineups ?? []).filter((x) => x.id !== id) })), [update]);
  const importSquad = useCallback(
    (squad: SquadPlayer[] | null, auctions: Auction[], lineups: SavedLineup[] = []) => {
      // Counted against what's here now; merged again against whatever is there when it lands.
      const s = latest.current;
      const players = squad ? mergeSquad(s.squad, squad) : null;
      const added = mergeAuctions(s.auctions, auctions).added;
      const kept = mergeAuctions(s.lineups ?? [], lineups).added;
      if ((players && players.added + players.updated) || added || kept)
        update((now) => ({
          ...now,
          squad: squad ? mergeSquad(now.squad, squad).squad : now.squad,
          auctions: mergeAuctions(now.auctions, auctions).auctions,
          lineups: mergeAuctions(now.lineups ?? [], lineups).auctions,
        }));
      return { players: players ? players.added + players.updated : 0, auctions: added, lineups: kept };
    },
    [update],
  );
  return createElement(
    SquadContext.Provider,
    { value: { squad: state.squad, setSquad, auctions: state.auctions, saveAuction, deleteAuction, lineups: state.lineups ?? [], saveLineup, deleteLineup, importSquad } },
    children,
  );
}

export function useSquad(): SquadStore {
  const store = useContext(SquadContext);
  if (!store) throw new Error('useSquad must be used inside SquadProvider');
  return store;
}
