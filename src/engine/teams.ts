import { ratedSquad, squadRatings } from './ratings.ts';
import { overall, type SquadPlayer } from './squad.ts';
import type { Match } from './types.ts';

// How strong a side is, and two even sides from whoever turns up. A player's strength is mostly their form (their
// last five match ratings), steadied by their stars, so one big game doesn't swing it; a newcomer plays to their stars.

/** One player as the sides are picked: their strength out of 10 and what they bring. */
export type Strength = {
  name: string;
  /** Out of 10. */
  power: number;
  /** Their last five ratings averaged, or null before they've played. */
  form: number | null;
  bat: number;
  bowl: number;
  keeper: boolean;
  /** Not in the squad: an average player until they are. */
  guest?: boolean;
};

const FORM_WEIGHT = 0.7;
/** What a name the squad doesn't know counts for. */
const GUEST_POWER = 5;

export const nameKey = (name: string) => name.trim().toLowerCase();
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Every squad player's strength, by name. */
export function strengths(matches: Match[], squad: SquadPlayer[]): Map<string, Strength> {
  const ratings = squadRatings(matches, squad);
  const out = new Map<string, Strength>();
  for (const p of ratedSquad(matches, squad)) {
    const form = ratings.get(p.id)?.form ?? null;
    const stars = overall(p) * 2;
    out.set(nameKey(p.name), {
      name: p.name,
      power: round1(form === null ? stars : FORM_WEIGHT * form + (1 - FORM_WEIGHT) * stars),
      form,
      bat: p.bat,
      bowl: p.bowl,
      keeper: Boolean(p.keeper || p.role === 'wk'),
    });
  }
  return out;
}

/** A name as the sides see it: from the squad, or a guest who counts as average. */
export function strengthOf(table: Map<string, Strength>, name: string): Strength {
  return table.get(nameKey(name)) ?? { name: name.trim(), power: GUEST_POWER, form: null, bat: 3, bowl: 3, keeper: false, guest: true };
}

export type SideStrength = {
  /** Their strength together: the players' strengths averaged, out of 10. */
  power: number;
  total: number;
  /** Batting and bowling stars, averaged (1 to 5). */
  bat: number;
  bowl: number;
  /** Form of those who have some, averaged; null when nobody has played yet. */
  form: number | null;
  /** Players with 3 or more bowling stars. */
  bowlers: number;
  keepers: number;
  /** Best first. */
  players: Strength[];
};

export function sideStrength(players: Strength[]): SideStrength {
  const n = players.length || 1;
  const formed = players.filter((p) => p.form !== null);
  const total = players.reduce((s, p) => s + p.power, 0);
  return {
    power: round1(total / n),
    total: round1(total),
    bat: round1(players.reduce((s, p) => s + p.bat, 0) / n),
    bowl: round1(players.reduce((s, p) => s + p.bowl, 0) / n),
    form: formed.length ? round1(formed.reduce((s, p) => s + (p.form ?? 0), 0) / formed.length) : null,
    bowlers: players.filter((p) => p.bowl >= 3).length,
    keepers: players.filter((p) => p.keeper).length,
    players: [...players].sort((a, b) => b.power - a.power),
  };
}

/**
 * How far apart two sides are: their strengths together first, then a keeper each (when there are two to go round),
 * then bowlers and batting spread evenly. Lower is fairer.
 */
function gap(a: Strength[], b: Strength[], keepers: number): number {
  const sum = (xs: Strength[], f: (p: Strength) => number) => xs.reduce((s, p) => s + f(p), 0);
  const kA = a.filter((p) => p.keeper).length;
  const kB = b.filter((p) => p.keeper).length;
  const keeperMiss = keepers >= 2 && (kA === 0 || kB === 0) ? 2 : 0;
  const bowlers = Math.abs(a.filter((p) => p.bowl >= 3).length - b.filter((p) => p.bowl >= 3).length);
  return Math.abs(sum(a, (p) => p.power) - sum(b, (p) => p.power)) + keeperMiss + bowlers * 0.4 + Math.abs(sum(a, (p) => p.bat) - sum(b, (p) => p.bat)) * 0.1;
}

/** A small seeded random: the same seed gives the same sides, the next seed another fair pair. */
function random(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Split = { sides: [Strength[], Strength[]]; strength: [SideStrength, SideStrength]; gap: number };

/**
 * Two even sides from everyone playing. Captains, when given, lead opposite sides. With an odd number one side has a
 * player more, and the strengths still even out (so it gets the weaker players). Each seed tries its own starting
 * sides and keeps swapping players while that makes them fairer; it then picks one of the fairest pairs it found, so
 * Shuffle gives a different but still even split.
 */
export function evenSides(players: Strength[], seed = 1, captains: [string?, string?] = []): Split {
  const rand = random(seed);
  const keepers = players.filter((p) => p.keeper).length;
  const caps = captains.map((c) => (c ? players.find((p) => nameKey(p.name) === nameKey(c)) : undefined));
  const rest = players.filter((p) => !caps.includes(p));
  const sizeA = Math.ceil(players.length / 2);
  const tries: { a: Strength[]; b: Strength[]; g: number }[] = [];
  for (let t = 0; t < 24; t++) {
    const order = [...rest].sort(() => rand() - 0.5);
    const a: Strength[] = caps[0] ? [caps[0]] : [];
    const b: Strength[] = caps[1] ? [caps[1]] : [];
    for (const p of order) (a.length < sizeA ? a : b).push(p);
    // Swap any two (but the captains) while it brings the sides closer.
    let g = gap(a, b, keepers);
    for (let better = true; better; ) {
      better = false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] === caps[0]) continue;
        for (let j = 0; j < b.length; j++) {
          if (b[j] === caps[1]) continue;
          [a[i], b[j]] = [b[j], a[i]];
          const next = gap(a, b, keepers);
          if (next < g - 1e-9) {
            g = next;
            better = true;
          } else [a[i], b[j]] = [b[j], a[i]];
        }
      }
    }
    tries.push({ a, b, g });
  }
  const best = Math.min(...tries.map((x) => x.g));
  const fair = tries.filter((x) => x.g <= best + 0.3);
  const pick = fair[Math.floor(rand() * fair.length)];
  const byPower = (xs: Strength[]) => [...xs].sort((p, q) => (caps.includes(q) ? 1 : 0) - (caps.includes(p) ? 1 : 0) || q.power - p.power);
  const sides: [Strength[], Strength[]] = [byPower(pick.a), byPower(pick.b)];
  return { sides, strength: [sideStrength(sides[0]), sideStrength(sides[1])], gap: round1(Math.abs(sides[0].reduce((s, p) => s + p.power, 0) - sides[1].reduce((s, p) => s + p.power, 0))) };
}

/**
 * Fill two sides up to `size` from the players not on either yet: the weaker side (by strength together) takes the
 * best one left, again and again. Returns who joined each side, in order.
 */
export function fillSides(sides: [string[], string[]], size: number, pool: Strength[], table: Map<string, Strength>): [string[], string[]] {
  const taken = new Set(sides.flat().filter((n) => n.trim()).map(nameKey));
  const left = pool.filter((p) => !taken.has(nameKey(p.name))).sort((a, b) => b.power - a.power);
  const named = sides.map((s) => s.filter((n) => n.trim()));
  const totals = named.map((s) => s.reduce((t, n) => t + strengthOf(table, n).power, 0));
  const joined: [string[], string[]] = [[], []];
  while (left.length) {
    const need = [0, 1].filter((i) => named[i].length + joined[i].length < size);
    if (!need.length) break;
    const side = need.length === 1 ? need[0] : totals[0] <= totals[1] ? 0 : 1;
    const p = left.shift()!;
    joined[side].push(p.name);
    totals[side] += p.power;
  }
  return joined;
}
