import { File, Paths } from 'expo-file-system';
import { createContext, createElement, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import type { Auction } from '../engine/auction.ts';
import { mergeAuctions, mergeSquad } from '../engine/backup.ts';
import { DEFAULT_SQUAD, setUsualKeepers, TEAMS_REVISION, updateSquad, type SquadPlayer } from '../engine/squad.ts';
import type { SavedLineup } from '../engine/teams.ts';
import { photoKey, type Photos } from '../engine/photos.ts';
import { setRegulars } from '../engine/stats.ts';

// The squad, the auctions and the saved line-ups, kept on this phone. Read synchronously at start-up, like the preferences, so the
// regulars are known before any stats are worked out.

/** `revision`: which version of the usual sides the squad was last brought up to. */
/** `keepers`: the club's keepers have been set on this squad (once; after that the squad screen decides). */
/** `photos`: each player's photo, by `photoKey`. */
type Saved = { squad: SquadPlayer[]; auctions: Auction[]; lineups?: SavedLineup[]; photos?: Photos; revision?: number; keepers?: number };

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
    let changed = false;
    // New sides since this phone last looked: rename and add the players they bring, once.
    if ((saved.revision ?? 1) < TEAMS_REVISION) {
      squad = updateSquad(squad);
      changed = true;
    }
    // The club's keepers, set once on a squad saved before they were known.
    if (raw && !saved.keepers) {
      squad = setUsualKeepers(squad);
      changed = true;
    }
    const next: Saved = { squad, auctions: saved.auctions ?? [], lineups: saved.lineups ?? [], photos: saved.photos ?? {}, revision: TEAMS_REVISION, keepers: 1 };
    if (changed) write(next);
    return next;
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
    return { squad: DEFAULT_SQUAD, auctions: [], revision: TEAMS_REVISION, keepers: 1 };
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
/**
 * Everyone who is or was in the squad is a regular (one career across sides, even after leaving), and every old name
 * of a renamed player reads as their name now.
 */
const regulars = (squad: SquadPlayer[]) =>
  setRegulars(
    squad.map((p) => p.name),
    Object.fromEntries(squad.flatMap((p) => (p.aka ?? []).map((old) => [old, p.name]))),
  );
regulars(startup.squad);

type SquadStore = {
  /** The squad as it is now: without the players taken off it. */
  squad: SquadPlayer[];
  /** Everyone who has been in the squad, for the club sync. */
  allSquad: SquadPlayer[];
  /** The squad as it is now. Anyone left out is taken off it but stays one person in the stats. */
  setSquad: (squad: SquadPlayer[]) => void;
  /** Rename a player: their matches under the old name stay theirs, and so does their photo. */
  renamePlayer: (oldName: string, newName: string) => void;
  auctions: Auction[];
  saveAuction: (a: Auction) => void;
  deleteAuction: (id: string) => void;
  lineups: SavedLineup[];
  saveLineup: (l: SavedLineup) => void;
  deleteLineup: (id: string) => void;
  /** A full backup's squad, auctions and line-ups, merged in: how many players joined or changed, and what was added. */
  importSquad: (squad: SquadPlayer[] | null, auctions: Auction[], lineups?: SavedLineup[]) => { players: number; auctions: number; lineups: number };
  /** The club sync: the club's squad, auctions, line-ups or photos, as they are. */
  setShared: (shared: { squad?: SquadPlayer[]; auctions?: Auction[]; lineups?: SavedLineup[]; photos?: Photos }) => void;
  photos: Photos;
  /** A player's photo, or none to take it away. */
  setPhoto: (name: string, photo: string | null) => void;

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
      if (next.squad !== s.squad) regulars(next.squad);
      return next;
    });
  }, []);
  const setSquad = useCallback(
    (squad: SquadPlayer[]) =>
      update((s) => {
        const ids = new Set(squad.map((p) => p.id));
        const names = new Set(squad.map((p) => p.name.trim().toLowerCase()));
        // Those taken off stay, marked, so their career isn't split into one per side; one added back returns.
        const gone = s.squad.filter((p) => !ids.has(p.id) && !names.has(p.name.trim().toLowerCase())).map((p) => ({ ...p, left: true }));
        return { ...s, squad: [...squad.map((p) => (p.left ? { ...p, left: undefined } : p)), ...gone] };
      }),
    [update],
  );
  const renamePlayer = useCallback(
    (oldName: string, newName: string) =>
      update((s) => {
        const from = oldName.trim();
        const to = newName.trim().replace(/\s+/g, ' ');
        if (!to || from.toLowerCase() === to.toLowerCase()) return s;
        const squad = s.squad.map((p) =>
          p.name.trim().toLowerCase() === from.toLowerCase() ? { ...p, name: to, aka: [...new Set([...(p.aka ?? []), from])] } : p,
        );
        const photos = { ...(s.photos ?? {}) };
        if (photos[photoKey(from)] && !photos[photoKey(to)]) {
          photos[photoKey(to)] = photos[photoKey(from)];
          delete photos[photoKey(from)];
        }
        return { ...s, squad, photos };
      }),
    [update],
  );
  const saveAuction = useCallback(
    (a: Auction) => update((s) => ({ ...s, auctions: [a, ...s.auctions.filter((x) => x.id !== a.id)].sort((x, y) => y.createdAt - x.createdAt) })),
    [update],
  );
  const deleteAuction = useCallback((id: string) => update((s) => ({ ...s, auctions: s.auctions.filter((x) => x.id !== id) })), [update]);
  const saveLineup = useCallback((l: SavedLineup) => update((s) => ({ ...s, lineups: [l, ...(s.lineups ?? []).filter((x) => x.id !== l.id)] })), [update]);
  const deleteLineup = useCallback((id: string) => update((s) => ({ ...s, lineups: (s.lineups ?? []).filter((x) => x.id !== id) })), [update]);
  const setShared = useCallback(
    (shared: { squad?: SquadPlayer[]; auctions?: Auction[]; lineups?: SavedLineup[]; photos?: Photos }) => update((s) => ({ ...s, ...shared })),
    [update],
  );
  const setPhoto = useCallback(
    (name: string, photo: string | null) =>
      update((s) => {
        const photos = { ...(s.photos ?? {}) };
        if (photo) photos[photoKey(name)] = photo;
        else delete photos[photoKey(name)];
        return { ...s, photos };
      }),
    [update],
  );
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
  const active = useMemo(() => state.squad.filter((p) => !p.left), [state.squad]);
  return createElement(
    SquadContext.Provider,
    { value: { squad: active, allSquad: state.squad, setSquad, renamePlayer, auctions: state.auctions, saveAuction, deleteAuction, lineups: state.lineups ?? [], saveLineup, deleteLineup, importSquad, setShared, photos: state.photos ?? {}, setPhoto } },
    children,
  );
}

export function useSquad(): SquadStore {
  const store = useContext(SquadContext);
  if (!store) throw new Error('useSquad must be used inside SquadProvider');
  return store;
}
