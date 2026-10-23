import type { SquadPlayer } from './squad.ts';

// An IPL-style auction that splits the day's players into two sides. Each captain starts with the same wallet
// (₹1 lakh by default); players come up one at a time and go to the highest bid. A captain can never bid so much that they
// couldn't still buy the rest of their side at the base price. A player nobody wants goes to the back of the
// queue once; the second time round someone has to take them. When one side is full, everyone left joins the
// other side at the base price.
//
// Like the scoring, an auction is a list of events: the state is worked out from them, and undo drops the last.

export type AuctionSettings = {
  /** Rupees each captain starts with. */
  purse: number;
  /** The opening bid, and what a player costs when nobody else bids. */
  base: number;
  /** How much each bid raises the last one. */
  step: number;
};

export type AuctionSide = { name: string; captain: string };

export type AuctionEvent = { type: 'sold'; player: string; side: 0 | 1; price: number } | { type: 'unsold'; player: string };

export type Auction = {
  id: string;
  createdAt: number;
  settings: AuctionSettings;
  sides: [AuctionSide, AuctionSide];
  /** Everyone taking part, captains included, as they were on the day (later squad edits don't change it). */
  roster: SquadPlayer[];
  /** The order players come up in (captains aren't in it: they lead their side for free). */
  order: string[];
  events: AuctionEvent[];
  /** The match these sides went on to play, once started. */
  matchId?: string;
};

export type Purchase = { player: string; price: number; auto?: boolean };

export type SideState = {
  name: string;
  captain: string;
  bought: Purchase[];
  /** Captain first, then in the order they were bought. */
  players: string[];
  spent: number;
  left: number;
  /** Places still to fill. */
  slots: number;
  /** The most this side may bid now, keeping the base price for each place after this one. */
  maxBid: number;
};

export type AuctionState = {
  sides: [SideState, SideState];
  /** Still to come up, the current player first. */
  queue: string[];
  current: string | null;
  /** The current player has already gone unsold once: someone has to take them. */
  lastCall: boolean;
  unsold: string[];
  /** Places on each side: half the players, rounded up. */
  sideSize: number;
  done: boolean;
};

export const DEFAULT_SETTINGS: AuctionSettings = { purse: 100_000, base: 5_000, step: 1_000 };

/** Rupees the Indian way: ₹1,00,000. */
export function money(n: number): string {
  const digits = String(Math.round(Math.abs(n)));
  const last3 = digits.slice(-3);
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}₹${head ? `${head},${last3}` : last3}`;
}

/** Short rupees for tight spaces: ₹1L, ₹2.5L, ₹45K, ₹500. */
export function moneyShort(n: number): string {
  if (n >= 100_000) return `₹${+(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000) return `₹${+(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}

export function newAuction(
  id: string,
  roster: SquadPlayer[],
  sides: [AuctionSide, AuctionSide],
  settings: AuctionSettings = DEFAULT_SETTINGS,
  shuffle: () => number = Math.random,
): Auction {
  const captains = new Set(sides.map((s) => s.captain));
  const order = roster.map((p) => p.id).filter((id) => !captains.has(id));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(shuffle() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { id, createdAt: Date.now(), settings, sides, roster, order, events: [] };
}

export function auctionState(a: Auction): AuctionState {
  const sideSize = Math.ceil(a.roster.length / 2);
  const bought: [Purchase[], Purchase[]] = [[], []];
  let queue = [...a.order];
  const passes = new Map<string, number>();

  for (const e of a.events) {
    queue = queue.filter((id) => id !== e.player);
    if (e.type === 'sold') bought[e.side].push({ player: e.player, price: e.price });
    else {
      passes.set(e.player, (passes.get(e.player) ?? 0) + 1);
      queue.push(e.player);
    }
  }

  const spent = (i: 0 | 1) => bought[i].reduce((n, p) => n + p.price, 0);
  const slots = (i: 0 | 1) => sideSize - 1 - bought[i].length;

  // One side full: the rest go to the other side at the base price (or whatever it has left).
  for (const i of [0, 1] as const) {
    const other = (1 - i) as 0 | 1;
    if (slots(i) <= 0 && queue.length) {
      for (const player of queue) {
        const price = Math.max(0, Math.min(a.settings.base, a.settings.purse - spent(other)));
        bought[other].push({ player, price, auto: true });
      }
      queue = [];
    }
  }

  const sides = a.sides.map((s, i) => {
    const side = i as 0 | 1;
    const left = a.settings.purse - spent(side);
    const free = slots(side);
    return {
      name: s.name,
      captain: s.captain,
      bought: bought[side],
      players: [s.captain, ...bought[side].map((p) => p.player)],
      spent: spent(side),
      left,
      slots: Math.max(0, free),
      maxBid: free > 0 ? Math.max(0, left - a.settings.base * (free - 1)) : 0,
    };
  }) as [SideState, SideState];

  const current = queue[0] ?? null;
  return {
    sides,
    queue,
    current,
    lastCall: current ? (passes.get(current) ?? 0) >= 1 : false,
    unsold: [...passes.keys()].filter((id) => queue.includes(id)),
    sideSize,
    done: !current,
  };
}

/** The bid that comes after `current` (none yet: the base price). */
export const nextBid = (a: Auction, current: number | null) => (current === null ? a.settings.base : current + a.settings.step);

export function canBid(a: Auction, side: 0 | 1, amount: number): boolean {
  const s = auctionState(a);
  return !s.done && s.sides[side].slots > 0 && amount <= s.sides[side].maxBid;
}

/** The current player goes to `side` for `price`. Throws if the side can't afford it. */
export function sell(a: Auction, side: 0 | 1, price: number): Auction {
  const s = auctionState(a);
  if (!s.current) throw new Error('Nobody is up for auction');
  if (!canBid(a, side, price)) throw new Error(`${s.sides[side].name} can't bid ${price}`);
  return { ...a, events: [...a.events, { type: 'sold', player: s.current, side, price }] };
}

/** Nobody bid: the current player goes to the back of the queue. Not allowed on a last call. */
export function passPlayer(a: Auction): Auction {
  const s = auctionState(a);
  if (!s.current || s.lastCall) throw new Error('This player has to be sold');
  return { ...a, events: [...a.events, { type: 'unsold', player: s.current }] };
}

export const undoAuction = (a: Auction): Auction => ({ ...a, events: a.events.slice(0, -1) });

export const rosterPlayer = (a: Auction, id: string) => a.roster.find((p) => p.id === id)!;
