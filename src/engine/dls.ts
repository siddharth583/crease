// Duckworth-Lewis (Standard Edition) target resetting for shortened matches.
//
// The resource table is the published Standard Edition table (ICC Playing Handbook 2008-09), as reproduced for
// 20 overs by Bhattacharya, Gill & Swartz, "Duckworth-Lewis and Twenty20 cricket" (Simon Fraser University),
// Table 2: every over from 20 down to 0, scaled so 20 overs with no wicket down is 100. Above 20 overs only the
// handbook's rows for 25, 30, 40 and 50 are published; overs in between are interpolated. (The newer DLS
// "Professional/Stern" edition is licensed software and is not public.)

/** Resources (%) with u overs left and w wickets down, for u = 0..20, scaled so (20, 0) = 100. */
const TO_20: number[][] = [
  /* 0 */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* 1 */ [6.4, 6.4, 6.4, 6.4, 6.4, 6.2, 6.2, 6.0, 5.7, 4.4],
  /* 2 */ [12.7, 12.5, 12.5, 12.4, 12.4, 12.0, 11.7, 11.0, 9.7, 6.5],
  /* 3 */ [18.7, 18.6, 18.4, 18.2, 18.0, 17.5, 16.8, 15.4, 12.7, 7.4],
  /* 4 */ [24.6, 24.4, 24.2, 23.9, 23.3, 22.4, 21.2, 18.9, 14.8, 8.0],
  /* 5 */ [30.4, 30.0, 29.7, 29.2, 28.4, 27.2, 25.3, 22.1, 16.6, 8.1],
  /* 6 */ [35.9, 35.5, 35.0, 34.3, 33.2, 31.4, 29.0, 24.6, 17.8, 8.1],
  /* 7 */ [41.3, 40.8, 40.1, 39.2, 37.8, 35.5, 32.2, 26.9, 18.6, 8.3],
  /* 8 */ [46.6, 45.9, 45.1, 43.8, 42.0, 39.4, 35.2, 28.6, 19.3, 8.3],
  /* 9 */ [51.8, 51.1, 49.8, 48.4, 46.1, 42.8, 37.8, 30.2, 19.8, 8.3],
  /* 10 */ [56.7, 55.8, 54.4, 52.7, 50.0, 46.1, 40.3, 31.6, 20.1, 8.3],
  /* 11 */ [61.7, 60.4, 59.0, 56.7, 53.7, 49.1, 42.4, 32.7, 20.3, 8.3],
  /* 12 */ [66.4, 65.0, 63.3, 60.6, 57.1, 51.9, 44.3, 33.6, 20.5, 8.3],
  /* 13 */ [71.0, 69.4, 67.3, 64.5, 60.4, 54.4, 46.1, 34.5, 20.7, 8.3],
  /* 14 */ [75.4, 73.7, 71.4, 68.0, 63.4, 56.9, 47.7, 35.2, 20.8, 8.3],
  /* 15 */ [79.9, 77.9, 75.3, 71.6, 66.4, 59.2, 49.1, 35.7, 20.8, 8.3],
  /* 16 */ [84.1, 81.8, 79.0, 74.7, 69.1, 61.3, 50.4, 36.2, 20.8, 8.3],
  /* 17 */ [88.2, 85.7, 82.5, 77.9, 71.7, 63.3, 51.6, 36.6, 21.0, 8.3],
  /* 18 */ [92.2, 89.6, 85.9, 81.1, 74.2, 65.0, 52.7, 36.9, 21.0, 8.3],
  /* 19 */ [96.1, 93.3, 89.2, 83.9, 76.7, 66.6, 53.5, 37.3, 21.0, 8.3],
  /* 20 */ [100.0, 96.8, 92.6, 86.7, 78.8, 68.2, 54.4, 37.5, 21.3, 8.3],
];

/** The handbook's 50-over rows above 20 overs (50-over scale, where (50, 0) = 100). */
const ABOVE_20: [number, number[]][] = [
  [25, [66.5, 63.9, 60.5, 56.0, 50.0, 42.2, 32.6, 21.6, 11.9, 4.7]],
  [30, [75.1, 71.8, 67.3, 61.6, 54.1, 44.7, 33.6, 21.8, 11.9, 4.7]],
  [40, [89.3, 84.2, 77.8, 69.6, 59.5, 47.6, 34.6, 22.0, 11.9, 4.7]],
  [50, [100.0, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9, 4.7]],
];
/** 20 overs, no wicket down, on the 50-over scale: converts between the two tables. */
const FIFTY_SCALE_AT_20 = 56.6;

function wholeOvers(u: number, w: number): number {
  if (u <= 20) return TO_20[u][w];
  // Interpolate between the published rows, converted to the same (20 overs = 100) scale.
  const rows: [number, number][] = [[20, TO_20[20][w]], ...ABOVE_20.map(([o, r]) => [o, (r[w] / FIFTY_SCALE_AT_20) * 100] as [number, number])];
  for (let i = 1; i < rows.length; i++) {
    const [o1, r1] = rows[i - 1];
    const [o2, r2] = rows[i];
    if (u <= o2) return r1 + ((r2 - r1) * (u - o1)) / (o2 - o1);
  }
  return rows[rows.length - 1][1];
}

/** Resources left with `ballsLeft` balls to come and `wickets` down (any scale: only ratios matter). */
export function resources(ballsLeft: number, wickets: number): number {
  const w = Math.min(9, Math.max(0, wickets));
  if (wickets >= 10 || ballsLeft <= 0) return 0;
  const u = Math.min(50, ballsLeft / 6);
  const lo = Math.floor(u);
  const hi = Math.min(50, Math.ceil(u));
  if (lo === hi) return wholeOvers(lo, w);
  return wholeOvers(lo, w) + (wholeOvers(hi, w) - wholeOvers(lo, w)) * (u - lo);
}

/** An interruption: overs per innings went from `before` to `after` with `balls` bowled and `wickets` down. */
export type Interruption = { innings: 0 | 1; balls: number; wickets: number; before: number; after: number };

/**
 * Resources an innings had: full resources for the overs it started with, less what each interruption took away.
 * Wickets are counted against the format's full side (10), as the table assumes.
 */
function inningsResources(startOvers: number, cuts: Interruption[]): number {
  let r = resources(startOvers * 6, 0);
  for (const c of cuts) r -= resources(c.before * 6 - c.balls, c.wickets) - resources(c.after * 6 - c.balls, c.wickets);
  return Math.max(0, r);
}

/**
 * The chase target under D/L Standard Edition. `firstRuns` is the first innings score; `g` the average score of
 * a full first innings in this format (used only when the chasing side has more resources than the first).
 * Wickets lost are scaled to a side of `sideSize` batters, so 7 down in an 8-a-side game reads like 9 down of 10.
 */
export function dlsTarget({
  firstRuns,
  originalOvers,
  interruptions,
  g,
  sideSize = 11,
}: {
  firstRuns: number;
  originalOvers: number;
  interruptions: Interruption[];
  g: number;
  sideSize?: number;
}) {
  const scale = (w: number) => Math.round((w * 10) / Math.max(1, sideSize - 1));
  const cuts = interruptions.map((c) => ({ ...c, wickets: scale(c.wickets) }));
  const first = cuts.filter((c) => c.innings === 0);
  const second = cuts.filter((c) => c.innings === 1);
  // The chase starts with whatever overs were set when the first innings ended.
  const chaseStart = first.length ? first[first.length - 1].after : originalOvers;
  const full = resources(originalOvers * 6, 0);
  const r1 = (inningsResources(originalOvers, first) / full) * 100;
  const r2 = (inningsResources(chaseStart, second) / full) * 100;
  const par = r2 <= r1 ? (firstRuns * r2) / r1 : firstRuns + (g * (r2 - r1)) / 100;
  return { r1: Math.round(r1 * 10) / 10, r2: Math.round(r2 * 10) / 10, par: Math.floor(par), target: Math.floor(par) + 1 };
}
