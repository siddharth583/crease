import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { fingerprint, planMatches, planShared, type RemoteMatch } from '../engine/sync.ts';
import { useMatches } from './matches.tsx';
import { useSquad } from './squad.ts';

// The club sync: everyone signed in to the club sees the same matches, squad, sides, auctions and line-ups, live.
// The phone keeps working on its own when there's no signal; it catches up when there is. Firebase (Google sign-in,
// Firestore) on the web app only, loaded the first time it's needed.

/** The club's Firebase project (crease-29555). Not a secret: the security rules are what keep the data the club's. */
const FIREBASE = {
  apiKey: 'AIzaSyBaRnc6I3xVAHQH3sSwFGEc8kCCPElyES0',
  authDomain: 'crease-29555.firebaseapp.com',
  projectId: 'crease-29555',
  storageBucket: 'crease-29555.firebasestorage.app',
  messagingSenderId: '571658663487',
  appId: '1:571658663487:web:a41cab714bb90a1b3a6a8a',
};
/**
 * The one club, and who's in it. The admin runs it (written into the security rules too); anyone signed in with a
 * club Google account (@copancs.com) sees everything; the admin makes scorers, and can let others outside it view.
 */
const CLUB = 'copan';
export const CLUB_OWNER = 'siddharth@copancs.com';
export const CLUB_DOMAIN = 'copancs.com';
/** Only the live app syncs: a test copy's made-up matches must never reach the club. */
export const LIVE_HOST = 'siddharth583.github.io';
const SHARED = ['squad', 'teams', 'auctions', 'lineups'] as const;
type SharedKey = (typeof SHARED)[number];
const LAST_KEY = 'crease.sync.v1';

export type ClubRole = 'owner' | 'scorer' | 'viewer';
/** Someone asking the admin to be an editor (scorer). Kept under their email; only they and the admin can see it. */
export type EditorRequest = { email: string; name: string; at: number; status: 'pending' | 'declined' };
export type SyncStatus = 'unavailable' | 'starting' | 'signed-out' | 'signing-in' | 'not-member' | 'syncing' | 'synced' | 'error';
type ClubSync = {
  status: SyncStatus;
  user: { email: string; name: string; photo: string | null } | null;
  role: ClubRole | null;
  members: Record<string, 'scorer' | 'viewer'>;
  lastSync: number | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** The owner only: add someone as a scorer or viewer, or take them off (null). */
  setMember: (email: string, role: 'scorer' | 'viewer' | null) => Promise<void>;
  /** The admin: requests waiting, oldest first. */
  requests: EditorRequest[];
  /** Everyone else: their own request, if they've made one. */
  myRequest: EditorRequest | null;
  requestEditor: () => Promise<void>;
  cancelRequest: () => Promise<void>;
  /** The admin: yes makes them an editor; no tells them it wasn't approved this time. */
  answerRequest: (email: string, yes: boolean) => Promise<void>;
};

/** What the phone and the club last agreed on, kept between visits. */
type Last = { matches: Record<string, string>; shared: Partial<Record<SharedKey, string>> };
const readLast = (): Last => {
  try {
    return { matches: {}, shared: {}, ...JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') };
  } catch {
    return { matches: {}, shared: {} };
  }
};
const writeLast = (last: Last) => {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(last));
  } catch {
    // Kept in memory; the next sync tries again.
  }
};

type Firebase = {
  auth: import('firebase/auth').Auth;
  db: import('firebase/firestore').Firestore;
  A: typeof import('firebase/auth');
  F: typeof import('firebase/firestore');
};
let loading: Promise<Firebase> | null = null;
function firebase(): Promise<Firebase> {
  loading ??= Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]).then(([app, A, F]) => {
    const fb = app.initializeApp(FIREBASE);
    return { auth: A.getAuth(fb), db: F.getFirestore(fb), A, F };
  });
  return loading;
}

const why = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return 'The club didn’t accept that: ask the owner for scorer access.';
  if (code.includes('unavailable') || code.includes('network')) return 'No connection. Everything is kept here and syncs when you’re back online.';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return null;
  return 'Couldn’t sync just now. It tries again on the next change.';
};

const Context = createContext<ClubSync | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const web = Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname === LIVE_HOST;
  const { ready, matches, savedTeams, fromClub, setTeams } = useMatches();
  const { squad, auctions, lineups, setShared } = useSquad();
  const [status, setStatus] = useState<SyncStatus>(web ? 'starting' : 'unavailable');
  const [user, setUser] = useState<ClubSync['user']>(null);
  const [role, setRole] = useState<ClubRole | null>(null);
  const [members, setMembers] = useState<ClubSync['members']>({});
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<EditorRequest[]>([]);
  const [myRequest, setMyRequest] = useState<EditorRequest | null>(null);
  // The club as last heard, and the phone as it is now, for the sync to compare whenever either changes.
  const remote = useRef<{ matches: Map<string, RemoteMatch> | null; shared: Partial<Record<SharedKey, string | null>> }>({ matches: null, shared: {} });
  const local = useRef({ matches, shared: { squad, teams: savedTeams, auctions, lineups } as Record<SharedKey, unknown> });
  local.current = { matches, shared: { squad, teams: savedTeams, auctions, lineups } };
  const apply = useRef({ fromClub, setTeams, setShared });
  apply.current = { fromClub, setTeams, setShared };
  const last = useRef<Last>(web ? readLast() : { matches: {}, shared: {} });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleRef = useRef<ClubRole | null>(null);
  roleRef.current = role;
  const email = user?.email ?? '';

  /** Compare the phone and the club, take what's newer from the club and send what's newer here. */
  const reconcile = useCallback(async () => {
    const r = remote.current;
    if (!r.matches || SHARED.some((k) => !(k in r.shared)) || !roleRef.current) return;
    const fb = await firebase();
    const writer = roleRef.current !== 'viewer';
    const by = email;
    const base = fb.F.collection(fb.db, 'clubs', CLUB, 'matches');
    const writes: Promise<unknown>[] = [];

    const plan = planMatches(local.current.matches, r.matches, last.current.matches);
    apply.current.fromClub(plan.take, plan.remove);
    const agreed = { ...last.current.matches, ...plan.agreed };
    for (const id of plan.remove) delete agreed[id];
    if (writer) {
      for (const m of plan.send) {
        const json = JSON.stringify(m);
        writes.push(fb.F.setDoc(fb.F.doc(base, m.id), { json, updatedAt: m.updatedAt ?? m.createdAt, by }));
        agreed[m.id] = fingerprint(json);
      }
      for (const id of plan.bury) {
        writes.push(fb.F.setDoc(fb.F.doc(base, id), { deleted: true, updatedAt: Date.now(), by }));
        delete agreed[id];
      }
    }

    const shared = { ...last.current.shared };
    for (const key of SHARED) {
      const mine = JSON.stringify(local.current.shared[key] ?? []);
      const theirs = r.shared[key] ?? null;
      const step = planShared(mine, theirs, shared[key]);
      if (step === 'take' && theirs !== null) {
        const value = JSON.parse(theirs);
        if (key === 'teams') apply.current.setTeams(value);
        else apply.current.setShared({ [key]: value });
        shared[key] = fingerprint(theirs);
      } else if (step === 'send' && writer) {
        writes.push(fb.F.setDoc(fb.F.doc(fb.db, 'clubs', CLUB, 'shared', key), { json: mine, updatedAt: Date.now(), by }));
        shared[key] = fingerprint(mine);
      } else if (step === 'none') shared[key] = fingerprint(mine);
    }

    last.current = { matches: agreed, shared };
    writeLast(last.current);
    try {
      await Promise.all(writes);
      setError(null);
      setStatus('synced');
      setLastSync(Date.now());
    } catch (e) {
      setError(why(e));
      setStatus('error');
    }
  }, [email]);

  const soon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void reconcile(), 600);
  }, [reconcile]);

  // Who's signed in.
  useEffect(() => {
    if (!web) return;
    let stop = () => {};
    let gone = false;
    firebase()
      .then((fb) => {
        if (gone) return;
        stop = fb.A.onAuthStateChanged(fb.auth, (u) => {
          setUser(u?.email ? { email: u.email.toLowerCase(), name: u.displayName ?? u.email, photo: u.photoURL } : null);
          if (!u) {
            setRole(null);
            setStatus('signed-out');
          }
        });
      })
      .catch(() => setStatus('error'));
    return () => {
      gone = true;
      stop();
    };
  }, [web]);

  // The club itself: who's in it, and as what. The owner makes it the first time.
  useEffect(() => {
    if (!web || !email) return;
    let stop = () => {};
    let gone = false;
    setStatus('syncing');
    firebase().then((fb) => {
      if (gone) return;
      const club = fb.F.doc(fb.db, 'clubs', CLUB);
      stop = fb.F.onSnapshot(
        club,
        (snap) => {
          const data = snap.data() as { members?: Record<string, 'scorer' | 'viewer'> } | undefined;
          if (!snap.exists()) {
            if (email === CLUB_OWNER) void fb.F.setDoc(club, { owner: CLUB_OWNER, members: {}, createdAt: Date.now() }).catch((e) => setError(why(e)));
            else setStatus('not-member');
            return;
          }
          setMembers(data?.members ?? {});
          const mine: ClubRole | null =
            email === CLUB_OWNER ? 'owner' : (data?.members?.[email] ?? (email.endsWith(`@${CLUB_DOMAIN}`) ? 'viewer' : null));
          setRole(mine);
          if (!mine) setStatus('not-member');
        },
        () => {
          setRole(null);
          setStatus('not-member');
        },
      );
    });
    return () => {
      gone = true;
      stop();
    };
  }, [web, email]);

  // The club's matches and shared things, live, once this person is in the club.
  useEffect(() => {
    if (!web || !role || !ready) return;
    let stops: (() => void)[] = [];
    let gone = false;
    remote.current = { matches: null, shared: {} };
    firebase().then((fb) => {
      if (gone) return;
      const fail = (e: unknown) => {
        setError(why(e));
        setStatus('error');
      };
      stops.push(
        fb.F.onSnapshot(
          fb.F.collection(fb.db, 'clubs', CLUB, 'matches'),
          (snap) => {
            const all = new Map<string, RemoteMatch>();
            snap.forEach((d) => all.set(d.id, d.data() as RemoteMatch));
            remote.current.matches = all;
            soon();
          },
          fail,
        ),
      );
      for (const key of SHARED) {
        stops.push(
          fb.F.onSnapshot(
            fb.F.doc(fb.db, 'clubs', CLUB, 'shared', key),
            (snap) => {
              remote.current.shared[key] = snap.exists() ? ((snap.data() as { json: string }).json ?? null) : null;
              soon();
            },
            fail,
          ),
        );
      }
    });
    return () => {
      gone = true;
      stops.forEach((s) => s());
      stops = [];
    };
  }, [web, role, ready, soon]);

  // Editor requests: the admin sees every one waiting; anyone else, their own.
  useEffect(() => {
    if (!web || !email) return;
    let stop = () => {};
    let gone = false;
    firebase().then((fb) => {
      if (gone) return;
      const col = fb.F.collection(fb.db, 'clubs', CLUB, 'requests');
      const quiet = () => {};
      if (email === CLUB_OWNER) {
        stop = fb.F.onSnapshot(
          col,
          (snap) => {
            const all: EditorRequest[] = [];
            snap.forEach((d) => all.push(d.data() as EditorRequest));
            setRequests(all.filter((r) => r.status === 'pending').sort((a, b) => a.at - b.at));
          },
          quiet,
        );
      } else {
        stop = fb.F.onSnapshot(fb.F.doc(col, email), (snap) => setMyRequest(snap.exists() ? (snap.data() as EditorRequest) : null), quiet);
      }
    });
    return () => {
      gone = true;
      stop();
      setRequests([]);
      setMyRequest(null);
    };
  }, [web, email]);

  // Anything changed on this phone: sync it.
  useEffect(() => {
    if (role) soon();
  }, [role, matches, savedTeams, squad, auctions, lineups, soon]);

  const signIn = useCallback(async () => {
    if (!web) return;
    const fb = await firebase();
    const provider = new fb.A.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    setStatus('signing-in');
    setError(null);
    try {
      await fb.A.signInWithPopup(fb.auth, provider);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? '';
      // Phones that block pop-ups sign in on a page of their own and come back.
      if (code.includes('popup-blocked') || code.includes('operation-not-supported')) await fb.A.signInWithRedirect(fb.auth, provider);
      else {
        setError(why(e));
        setStatus('signed-out');
      }
    }
  }, [web]);

  const signOut = useCallback(async () => {
    if (!web) return;
    const fb = await firebase();
    await fb.A.signOut(fb.auth);
  }, [web]);

  const setMember = useCallback(
    async (who: string, as: 'scorer' | 'viewer' | null) => {
      if (role !== 'owner') return;
      const fb = await firebase();
      const next = { ...members };
      const key = who.trim().toLowerCase();
      if (as) next[key] = as;
      else delete next[key];
      // The whole club at once: an email's dots would read as a path in a partial update.
      await fb.F.setDoc(fb.F.doc(fb.db, 'clubs', CLUB), { owner: CLUB_OWNER, members: next, updatedAt: Date.now() });
    },
    [role, members],
  );

  const requestEditor = useCallback(async () => {
    if (!web || !user) return;
    const fb = await firebase();
    try {
      await fb.F.setDoc(fb.F.doc(fb.db, 'clubs', CLUB, 'requests', user.email), { email: user.email, name: user.name, at: Date.now(), status: 'pending' });
      setError(null);
    } catch (e) {
      setError(why(e));
    }
  }, [web, user]);

  const cancelRequest = useCallback(async () => {
    if (!web || !user) return;
    const fb = await firebase();
    await fb.F.deleteDoc(fb.F.doc(fb.db, 'clubs', CLUB, 'requests', user.email)).catch((e) => setError(why(e)));
  }, [web, user]);

  const answerRequest = useCallback(
    async (who: string, yes: boolean) => {
      if (role !== 'owner') return;
      const fb = await firebase();
      const ref = fb.F.doc(fb.db, 'clubs', CLUB, 'requests', who);
      if (yes) {
        await setMember(who, 'scorer');
        await fb.F.deleteDoc(ref);
      } else await fb.F.updateDoc(ref, { status: 'declined' });
    },
    [role, setMember],
  );

  const value = useMemo<ClubSync>(
    () => ({ status, user, role, members, lastSync, error, signIn, signOut, setMember, requests, myRequest, requestEditor, cancelRequest, answerRequest }),
    [status, user, role, members, lastSync, error, signIn, signOut, setMember, requests, myRequest, requestEditor, cancelRequest, answerRequest],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useClubSync(): ClubSync {
  const s = useContext(Context);
  if (!s) throw new Error('useClubSync must be used inside SyncProvider');
  return s;
}
