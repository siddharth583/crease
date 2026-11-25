import { allOutAt, inningsState, type InningsState } from './engine.ts';
import type { Match } from './types.ts';

// Who is winning a chase, ball by ball. Not a betting model: a plain estimate from what the chase needs (runs, balls,
// wickets in hand) against how fast this match is being scored, good enough to tell "cruising" from "slipping".

/** The standard normal's cumulative distribution (Abramowitz and Stegun 7.1.26 for erf). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return 0.5 * (1 + (z >= 0 ? erf : -erf));
}

/** Runs needed, balls and wickets left, and the rate the target was set at: the whole input of the estimate. */
export type ChaseSituation = { need: number; ballsLeft: number; wickets: number; maxWickets: number; ownRuns: number; ownBalls: number; parRate: number };

/**
 * The chasing side's chance of winning, 0 to 1. Settled states are exactly 1 (target reached) or 0 (out of balls or
 * wickets); anything live stays between 1% and 99%.
 *
 * The runs still to come are the balls left at a rate (the target's own rate, nudged towards the chase's own once it has
 * faced a few balls), cut down by the wickets lost; how far that lands from the runs needed, against the spread a few
 * balls of cricket can have, is the chance.
 */
export function chaseChance(c: ChaseSituation): number {
  if (c.need <= 0) return 1;
  if (c.ballsLeft <= 0 || c.wickets >= c.maxWickets) return 0;
  const trust = Math.min(c.ownBalls, 24) / 24 / 2;
  const own = c.ownBalls ? c.ownRuns / c.ownBalls : c.parRate;
  const rate = c.parRate * (1 - trust) + own * trust;
  const inHand = (c.maxWickets - c.wickets) / c.maxWickets;
  const expected = rate * c.ballsLeft * (0.35 + 0.65 * inHand ** 0.6);
  const spread = Math.max(1, 1.6 * Math.sqrt(c.ballsLeft) * (1 + 0.5 * (1 - inHand)));
  return Math.min(0.99, Math.max(0.01, normalCdf((expected + 0.5 - c.need) / spread)));
}

/** A chase (an innings with a target) as the situation the estimate takes; null for a first innings. */
export function situationOf(match: Match, s: InningsState): ChaseSituation | null {
  if (s.target === null) return null;
  const maxWickets = allOutAt(match.rules, s.battingTeam);
  return {
    need: s.target - s.runs,
    ballsLeft: Math.max(0, s.maxBalls - s.legalBalls),
    wickets: s.wickets,
    maxWickets,
    ownRuns: s.runs,
    ownBalls: s.legalBalls,
    // What the target asks for each ball: the first innings' rate, or the revised one after rain.
    parRate: s.maxBalls ? Math.max(0, s.target - 1) / s.maxBalls : 0,
  };
}

export type ChasePoint = {
  /** Legal balls faced by the chase. */
  balls: number;
  runs: number;
  wickets: number;
  need: number;
  ballsLeft: number;
  /** Runs a ball so far; null before the first ball. */
  crr: number | null;
  /** Runs a ball still needed; null once it's won or the balls are gone. */
  rrr: number | null;
  /** The chasing side's chance, 0 to 1. */
  chance: number;
};

const pointOf = (match: Match, s: InningsState): ChasePoint | null => {
  const c = situationOf(match, s);
  if (!c) return null;
  return {
    balls: s.legalBalls,
    runs: s.runs,
    wickets: s.wickets,
    need: Math.max(0, c.need),
    ballsLeft: c.ballsLeft,
    crr: s.legalBalls ? s.runs / s.legalBalls : null,
    rrr: c.need > 0 && c.ballsLeft > 0 ? c.need / c.ballsLeft : null,
    chance: chaseChance(c),
  };
};

/**
 * The chase after every ball: the start, then one point per delivery, in order. Replays the second innings a ball at a
 * time, so it follows corrections made to earlier balls too. Empty unless the match has a chase with a target.
 */
export function chaseTimeline(match: Match, target: number | null): ChasePoint[] {
  const inn = match.innings[1];
  if (!inn || target === null) return [];
  const points: ChasePoint[] = [];
  const at = (events: number) => {
    const part: Match = { ...match, innings: match.innings.map((x, i) => (i === 1 ? { ...x, events: x.events.slice(0, events) } : x)) };
    const p = pointOf(match, inningsState(part, 1, target));
    if (p) points.push(p);
  };
  at(0);
  inn.events.forEach((e, i) => {
    if (e.type === 'ball') at(i + 1);
  });
  return points.filter((p, i) => i === 0 || p.balls !== points[i - 1].balls || p.runs !== points[i - 1].runs || p.wickets !== points[i - 1].wickets);
}
