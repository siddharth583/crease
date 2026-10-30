import { ballView, matchState, oversText, type BallView, type InningsState } from './engine.ts';
import { battingAverage, careerStats, COMMON_TEAM, displayName, keyFor, playerOfTheMatch } from './stats.ts';
import type { Match, Team, WicketKind } from './types.ts';

// The record book: the best (and worst) of every saved match. Only the two main innings count, not super overs.

type Where = { vs: string; date: number; matchId: string };
export type ScoreRecord = Where & { name: string; key: string; team: string; runs: number; balls: number; notOut: boolean };
export type BowlingRecord = Where & { name: string; key: string; team: string; wickets: number; runs: number; overs: string };
export type PartnershipRecord = Where & { names: string; team: string; runs: number; balls: number };
export type TotalRecord = Where & { team: string; runs: number; wickets: number; overs: string; /** A chase that got there: not a low total, however few runs it needed. */ wonChase: boolean };
export type CountRecord = { name: string; key: string; team: string; count: number; /** A line of context, e.g. "in 7 matches". */ sub?: string };
/** A rate (strike rate, economy) with the numbers behind it. */
export type RateRecord = { name: string; key: string; team: string; rate: number; sub: string };
export type OverRecord = Where & { bowler: string; key: string; team: string; batting: string; runs: number; over: number; balls: BallView[] };
export type WinRecord = Where & { winner: string; loser: string; margin: number; by: 'runs' | 'wickets'; result: string };
export type SeasonSummary = { matches: number; runs: number; wickets: number; fours: number; sixes: number; balls: number; fifties: number; ducks: number };
export type Matchup = {
  /** `batterKey>bowlerKey`: the batter facing the bowler (the other way round is a different rivalry). */
  id: string;
  batter: string;
  bowler: string;
  batterKey: string;
  bowlerKey: string;
  balls: number;
  runs: number;
  outs: number;
  dots: number;
  fours: number;
  sixes: number;
  /** Matches they met in. */
  matches: number;
};

export type RivalryBall = { over: string; view: BallView; runs: number; out: boolean };
export type RivalryMeeting = { matchId: string; date: number; title: string; balls: RivalryBall[]; runs: number; faced: number; out: WicketKind | null };
export type Rivalry = Matchup & {
  /** Balls that went for 1, 2 or 3. */
  singles: number;
  /** No-balls bowled to the batter (their runs count to the batter). */
  noBalls: number;
  dismissals: { kind: WicketKind; fielder: string | null; matchId: string; date: number; over: string }[];
  meetings: RivalryMeeting[];
  /** The same two the other way round: the bowler batting, the batter bowling. */
  reverse: Matchup | null;
};

export type Verdict = {
  side: 'batter' | 'bowler' | 'even';
  title: string;
  line: string;
  /** 0 (all bowler) to 1 (all batter). */
  edge: number;
  /** Too few balls to call it yet: the bar only leans a little. */
  early: boolean;
  /** How each usually goes against everyone else, when there's enough to say. */
  batterUsual: { sr: number; perOut: number | null; balls: number } | null;
  bowlerUsual: { sr: number; perOut: number | null; balls: number } | null;
};

/** Faced balls, runs and dismissals: the numbers behind every rivalry. */
type Tally = { balls: number; runs: number; outs: number };

/**
 * What the rivalries are judged against: how every batter and every bowler goes across all their duels, and what a
 * wicket is worth in runs in these matches.
 */
export type RivalryContext = { all: Tally; batters: Map<string, Tally>; bowlers: Map<string, Tally> };

export function rivalryContext(all: Matchup[]): RivalryContext {
  const add = (map: Map<string, Tally>, key: string, x: Tally) => {
    const t = map.get(key) ?? { balls: 0, runs: 0, outs: 0 };
    map.set(key, { balls: t.balls + x.balls, runs: t.runs + x.runs, outs: t.outs + x.outs });
  };
  const ctx: RivalryContext = { all: { balls: 0, runs: 0, outs: 0 }, batters: new Map(), bowlers: new Map() };
  for (const x of all) {
    ctx.all = { balls: ctx.all.balls + x.balls, runs: ctx.all.runs + x.runs, outs: ctx.all.outs + x.outs };
    add(ctx.batters, x.batterKey, x);
    add(ctx.bowlers, x.bowlerKey, x);
  }
  return ctx;
}

const nameOf = (match: Match, id: string | null) => displayName(match.teams.flatMap((t) => t.players).find((p) => p.id === id)?.name ?? '');

function sideOf(match: Match, id: string): { team: Team; key: string; label: string } | null {
  for (const team of match.teams) {
    const p = team.players.find((x) => x.id === id);
    if (p) return { team, key: keyFor(team, p), label: p.common ? COMMON_TEAM : team.name };
  }
  return null;
}

function innings(matches: Match[]) {
  return matches.flatMap((m) => {
    const st = matchState(m);
    return st.innings.slice(0, 2).map((s, i) => ({ m, s, done: s.status === 'done', started: m.innings[i].events.length > 0, wonChase: i === 1 && st.winner === s.battingTeam.id }));
  });
}

const top = <T,>(list: T[], by: (x: T) => number, n = 5) => [...list].sort((a, b) => by(b) - by(a)).slice(0, n);

export function records(matches: Match[]) {
  const all = innings(matches).filter((x) => x.started);
  const where = (m: Match, s: InningsState): Where => ({ vs: s.bowlingTeam.name, date: m.createdAt, matchId: m.id });

  const scores: ScoreRecord[] = all.flatMap(({ m, s }) =>
    s.batters.map((b) => {
      const side = sideOf(m, b.id)!;
      return { ...where(m, s), name: nameOf(m, b.id), key: side.key, team: side.label, runs: b.runs, balls: b.balls, notOut: !b.out };
    }),
  );
  const bowling: BowlingRecord[] = all.flatMap(({ m, s }) =>
    s.bowlers
      .filter((b) => b.balls)
      .map((b) => {
        const side = sideOf(m, b.id)!;
        return { vs: s.battingTeam.name, date: m.createdAt, matchId: m.id, name: nameOf(m, b.id), key: side.key, team: side.label, wickets: b.wickets, runs: b.runs, overs: oversText(b.balls) };
      }),
  );
  const partnerships: PartnershipRecord[] = all.flatMap(({ m, s }) =>
    s.partnerships
      .filter((p) => p.runs > 0)
      .map((p) => ({
        ...where(m, s),
        names: p.batters.filter(Boolean).map((id) => nameOf(m, id)).join(' & '),
        team: s.battingTeam.name,
        runs: p.runs,
        balls: p.balls,
      })),
  );
  const totals: TotalRecord[] = all
    .filter((x) => x.done)
    .map(({ m, s, wonChase }) => ({ ...where(m, s), team: s.battingTeam.name, runs: s.runs, wickets: s.wickets, overs: oversText(s.legalBalls), wonChase }));

  const careers = careerStats(matches);
  const moms = new Map<string, CountRecord>();
  for (const m of matches) {
    const mom = playerOfTheMatch(m);
    if (!mom) continue;
    const r: CountRecord = moms.get(mom.key) ?? { name: mom.name, key: mom.key, team: mom.team, count: 0 };
    r.count += 1;
    moms.set(mom.key, r);
  }

  // The dearest overs: runs off each over with the bowler who bowled it and how it went.
  const overs: OverRecord[] = all.flatMap(({ m, s }) =>
    s.overs.flatMap((balls, i) => {
      const first = s.log.find((d) => d.over.startsWith(`${i}.`));
      if (!first?.bowler || !balls.length) return [];
      const side = sideOf(m, first.bowler);
      if (!side) return [];
      return [{ vs: s.battingTeam.name, date: m.createdAt, matchId: m.id, bowler: nameOf(m, first.bowler), key: side.key, team: side.label, batting: s.battingTeam.name, runs: s.overTotals[i]?.runs ?? 0, over: i + 1, balls }];
    }),
  );

  const wins: WinRecord[] = matches.flatMap((m) => {
    const st = matchState(m);
    const hit = st.result?.match(/won by (\d+) (run|wicket)/);
    if (!hit || !st.winner) return [];
    const winner = m.teams.find((t) => t.id === st.winner)!;
    const loser = m.teams.find((t) => t.id !== st.winner)!;
    return [{ vs: loser.name, date: m.createdAt, matchId: m.id, winner: winner.name, loser: loser.name, margin: Number(hit[1]), by: hit[2] === 'run' ? ('runs' as const) : ('wickets' as const), result: st.result! }];
  });

  const summary: SeasonSummary = {
    matches: matches.filter((m) => matchState(m).result).length,
    runs: all.reduce((n, x) => n + x.s.runs, 0),
    wickets: all.reduce((n, x) => n + x.s.wickets, 0),
    fours: careers.reduce((n, c) => n + c.batting.fours, 0),
    sixes: careers.reduce((n, c) => n + c.batting.sixes, 0),
    balls: all.reduce((n, x) => n + x.s.legalBalls, 0),
    fifties: scores.filter((x) => x.runs >= 50).length,
    ducks: careers.reduce((n, c) => n + c.batting.ducks, 0),
  };
  const played = (c: (typeof careers)[number]) => `in ${c.matches} match${c.matches === 1 ? '' : 'es'}`;

  // What each bowler gave away ball by ball: dots (nothing off the ball at all), and wides and no-balls.
  const given = new Map<string, { dots: number; wides: number; noballs: number }>();
  const tallyOf = (key: string) => given.get(key) ?? (given.set(key, { dots: 0, wides: 0, noballs: 0 }), given.get(key)!);
  for (const { m, s } of all) {
    for (const b of s.bowlers) {
      const side = sideOf(m, b.id);
      if (!side) continue;
      const g = tallyOf(side.key);
      g.wides += b.wides;
      g.noballs += b.noballs;
    }
    for (const d of s.log) {
      const side = d.bowler ? sideOf(m, d.bowler) : null;
      if (side && d.total === 0 && d.ball.extra !== 'wide' && d.ball.extra !== 'noball') tallyOf(side.key).dots += 1;
    }
  }
  const bowlers = careers.filter((c) => c.bowling.balls);
  const tally = (c: (typeof careers)[number]) => given.get(c.key) ?? { dots: 0, wides: 0, noballs: 0 };
  const oversOf = (c: (typeof careers)[number]) => `${oversText(c.bowling.balls)} overs`;
  const outs = (c: (typeof careers)[number]) => c.batting.innings - c.batting.notOuts;

  return {
    summary,
    mostRuns: top(careers.filter((c) => c.batting.runs), (c) => c.batting.runs).map((c) => ({ name: c.name, key: c.key, team: c.team, count: c.batting.runs, sub: `${played(c)} · best ${c.batting.highest}${c.batting.highestNotOut ? '*' : ''}` })),
    mostWickets: top(careers.filter((c) => c.bowling.wickets), (c) => c.bowling.wickets * 1000 - c.bowling.runs).map((c) => ({ name: c.name, key: c.key, team: c.team, count: c.bowling.wickets, sub: `${played(c)} · best ${c.bowling.best ? `${c.bowling.best.wickets}/${c.bowling.best.runs}` : '–'}` })),
    bestStrikeRate: top(careers.filter((c) => c.batting.balls >= 30), (c) => c.batting.runs / c.batting.balls).map((c) => ({ name: c.name, key: c.key, team: c.team, rate: (c.batting.runs * 100) / c.batting.balls, sub: `${c.batting.runs} runs off ${c.batting.balls} balls` })),
    bestEconomy: top(careers.filter((c) => c.bowling.balls >= 36), (c) => -c.bowling.runs / c.bowling.balls).map((c) => ({ name: c.name, key: c.key, team: c.team, rate: (c.bowling.runs * 6) / c.bowling.balls, sub: `${c.bowling.runs} runs off ${oversText(c.bowling.balls)} overs` })),
    mostFours: top(careers.filter((c) => c.batting.fours), (c) => c.batting.fours).map((c) => ({ name: c.name, key: c.key, team: c.team, count: c.batting.fours, sub: played(c) })),
    dearestOvers: top(overs, (x) => x.runs),
    biggestWinsByRuns: top(wins.filter((w) => w.by === 'runs'), (w) => w.margin, 3),
    biggestWinsByWickets: top(wins.filter((w) => w.by === 'wickets'), (w) => w.margin, 3),
    mostDucks: top(careers.filter((c) => c.batting.ducks), (c) => c.batting.ducks, 3).map((c) => ({ name: c.name, key: c.key, team: c.team, count: c.batting.ducks, sub: played(c) })),
    highScores: top(scores, (x) => x.runs * 1000 - x.balls),
    bestBowling: top(bowling, (x) => x.wickets * 1000 - x.runs),
    fastest: top(
      scores.filter((x) => x.balls >= 15),
      (x) => x.runs / x.balls,
    ),
    partnerships: top(partnerships, (x) => x.runs),
    highestTotals: top(totals, (x) => x.runs),
    lowestTotals: top(totals.filter((x) => !x.wonChase), (x) => -x.runs, 3),
    mostSixes: top(careers.filter((c) => c.batting.sixes), (c) => c.batting.sixes).map((c) => ({ name: c.name, key: c.key, team: c.team, count: c.batting.sixes, sub: played(c) })),
    mostDismissals: top(
      careers.filter((c) => c.fielding.catches + c.fielding.runOuts + c.fielding.stumpings),
      (c) => c.fielding.catches + c.fielding.runOuts + c.fielding.stumpings,
    ).map((c) => ({ name: c.name, key: c.key, team: c.team, count: c.fielding.catches + c.fielding.runOuts + c.fielding.stumpings, sub: [c.fielding.catches && `${c.fielding.catches} caught`, c.fielding.runOuts && `${c.fielding.runOuts} run out`, c.fielding.stumpings && `${c.fielding.stumpings} stumped`].filter(Boolean).join(' · ') })),
    mostMoM: top([...moms.values()], (x) => x.count),
    bestAverage: top(careers.filter((c) => c.batting.innings >= 3 && outs(c) > 0), (c) => battingAverage(c) ?? 0).map((c) => ({
      name: c.name,
      key: c.key,
      team: c.team,
      rate: battingAverage(c) ?? 0,
      sub: `${c.batting.runs} runs · out ${outs(c)} time${outs(c) === 1 ? '' : 's'} in ${c.batting.innings} innings`,
    })),
    mostDots: top(bowlers.filter((c) => tally(c).dots), (c) => tally(c).dots).map((c) => ({
      name: c.name,
      key: c.key,
      team: c.team,
      count: tally(c).dots,
      sub: `${Math.round((tally(c).dots * 100) / c.bowling.balls)}% of ${c.bowling.balls} balls`,
    })),
    mostFoursConceded: top(bowlers.filter((c) => c.bowling.fours), (c) => c.bowling.fours).map((c) => ({ name: c.name, key: c.key, team: c.team, count: c.bowling.fours, sub: `${oversOf(c)} · ${played(c)}` })),
    mostSixesConceded: top(bowlers.filter((c) => c.bowling.sixes), (c) => c.bowling.sixes).map((c) => ({ name: c.name, key: c.key, team: c.team, count: c.bowling.sixes, sub: `${oversOf(c)} · ${played(c)}` })),
    mostExtras: top(bowlers.filter((c) => tally(c).wides + tally(c).noballs), (c) => tally(c).wides + tally(c).noballs).map((c) => ({
      name: c.name,
      key: c.key,
      team: c.team,
      count: tally(c).wides + tally(c).noballs,
      sub: `${tally(c).wides} wide${tally(c).wides === 1 ? '' : 's'} · ${tally(c).noballs} no-ball${tally(c).noballs === 1 ? '' : 's'} · ${played(c)}`,
    })),
    dearestSpells: top(bowling, (x) => x.runs * 1000 - x.wickets, 3),
  };
}

/** Every team name that has played, for the head-to-head picker. */
export function teamNames(matches: Match[]): string[] {
  return [...new Set(matches.flatMap((m) => m.teams.map((t) => t.name.trim())))].sort();
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function headToHead(matches: Match[], a: string, b: string) {
  const games = matches
    .filter((m) => {
      const [x, y] = m.teams.map((t) => t.name);
      return (same(x, a) && same(y, b)) || (same(x, b) && same(y, a));
    })
    .sort((p, q) => q.createdAt - p.createdAt);
  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  let bestA = 0;
  let bestB = 0;
  const recent: { matchId: string; date: number; result: string; winner: 'a' | 'b' | null }[] = [];
  for (const m of games) {
    const st = matchState(m);
    if (!st.result) continue;
    const winner = m.teams.find((t) => t.id === st.winner)?.name;
    const side = winner ? (same(winner, a) ? 'a' : 'b') : null;
    if (side === 'a') winsA += 1;
    else if (side === 'b') winsB += 1;
    else ties += 1;
    for (const s of st.innings.slice(0, 2)) {
      if (same(s.battingTeam.name, a)) bestA = Math.max(bestA, s.runs);
      else bestB = Math.max(bestB, s.runs);
    }
    recent.push({ matchId: m.id, date: m.createdAt, result: st.result, winner: side });
  }
  return { played: winsA + winsB + ties, winsA, winsB, ties, bestA, bestB, recent: recent.slice(0, 5) };
}

/** Batter against bowler, across every match: the duels that keep happening. */
/** Every ball a batter faced from a bowler, wides aside (a wide isn't faced), in match order. */
function* faced(matches: Match[]) {
  for (const { m, s } of innings([...matches].sort((a, b) => a.createdAt - b.createdAt))) {
    for (const d of s.log) {
      if (!d.striker || !d.bowler || d.ball.extra === 'wide') continue;
      const bat = sideOf(m, d.striker);
      const bowl = sideOf(m, d.bowler);
      if (!bat || !bowl) continue;
      const out = Boolean(d.ball.wicket && d.ball.wicket.playerOut === d.striker && d.ball.wicket.kind !== 'runout' && !d.ball.wicket.kind.startsWith('retired'));
      // Byes and leg byes aren't the batter's runs.
      const runs = !d.ball.extra || d.ball.extra === 'noball' ? d.ball.runs : 0;
      yield { m, d, bat, bowl, out, runs };
    }
  }
}

export function matchups(matches: Match[]): Matchup[] {
  const pairs = new Map<string, Matchup & { seen: Set<string> }>();
  for (const { m, d, bat, bowl, out, runs } of faced(matches)) {
    const id = `${bat.key}>${bowl.key}`;
    let p = pairs.get(id);
    if (!p) {
      p = { id, batter: nameOf(m, d.striker), bowler: nameOf(m, d.bowler), batterKey: bat.key, bowlerKey: bowl.key, balls: 0, runs: 0, outs: 0, dots: 0, fours: 0, sixes: 0, matches: 0, seen: new Set() };
      pairs.set(id, p);
    }
    p.balls += 1;
    p.runs += runs;
    if (out) p.outs += 1;
    // A dot: nothing off the bat and no wicket. A no-ball gave the batting side a run, so it isn't one.
    if (!runs && !out && d.ball.extra !== 'noball') p.dots += 1;
    if (runs === 4 && !d.ball.extra) p.fours += 1;
    if (runs === 6 && !d.ball.extra) p.sixes += 1;
    p.seen.add(m.id);
    p.matches = p.seen.size;
  }
  return [...pairs.values()].map(({ seen: _, ...p }) => p);
}

/** Everything between one batter and one bowler: the numbers, every meeting ball by ball, and the other way round. */
export function rivalry(matches: Match[], batterKey: string, bowlerKey: string): Rivalry | null {
  const all = matchups(matches);
  const base = all.find((x) => x.batterKey === batterKey && x.bowlerKey === bowlerKey);
  if (!base) return null;
  const r: Rivalry = { ...base, singles: 0, noBalls: 0, dismissals: [], meetings: [], reverse: all.find((x) => x.batterKey === bowlerKey && x.bowlerKey === batterKey) ?? null };
  for (const { m, d, bat, bowl, out, runs } of faced(matches)) {
    if (bat.key !== batterKey || bowl.key !== bowlerKey) continue;
    if (runs >= 1 && runs <= 3) r.singles += 1;
    if (d.ball.extra === 'noball') r.noBalls += 1;
    if (out) r.dismissals.push({ kind: d.ball.wicket!.kind, fielder: d.ball.wicket!.fielder ? nameOf(m, d.ball.wicket!.fielder) : null, matchId: m.id, date: m.createdAt, over: d.over });
    let meeting = r.meetings.find((x) => x.matchId === m.id);
    if (!meeting) {
      meeting = { matchId: m.id, date: m.createdAt, title: `${m.teams[0].name} v ${m.teams[1].name}`, balls: [], runs: 0, faced: 0, out: null };
      r.meetings.push(meeting);
    }
    meeting.balls.push({ over: d.over, view: ballView(m.rules, d.ball), runs, out });
    meeting.runs += runs;
    meeting.faced += 1;
    if (out) meeting.out = d.ball.wicket!.kind;
  }
  r.meetings.reverse();
  return r;
}

const first = (name: string) => name.trim().split(/\s+/)[0];

/** Balls before a rivalry is called: under this it only leans. */
export const BALLS_TO_CALL = 8;
/** How many balls of "usual" a small sample is pulled towards: the fewer balls, the less it's trusted. */
const TRUST = 12;

const minus = (a: Tally, b: Tally): Tally => ({ balls: a.balls - b.balls, runs: a.runs - b.runs, outs: a.outs - b.outs });
const srOf = (t: Tally) => (t.balls ? (t.runs * 100) / t.balls : 0);
const perOutOf = (t: Tally) => (t.outs ? t.balls / t.outs : null);
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const balls = (n: number) => `${n} ball${n === 1 ? '' : 's'}`;

/**
 * Who's winning the contest. Each ball is worth its runs to the batter, and a wicket costs the batter what a wicket
 * is worth in these matches (the runs scored for every one that fell). The duel is set against what you'd expect:
 * this batter against everyone else, and this bowler against everyone else. A small sample is trusted less, and under
 * `BALLS_TO_CALL` balls it isn't called at all. Without a context, it's judged against a short game's usual alone.
 */
export function verdict(x: Matchup, ctx?: RivalryContext): Verdict {
  const all = ctx?.all ?? { balls: 0, runs: 0, outs: 0 };
  // A wicket's worth in runs: half what's scored for each one that falls, since in a short game the batters after
  // keep the rate going. With little to go on, a short game's typical numbers.
  const wicket = all.outs >= 5 ? Math.max(6, (0.5 * all.runs) / all.outs) : 10;
  const usualNet = all.balls >= 60 ? (all.runs - all.outs * wicket) / all.balls : 1.2 - wicket / 18;
  const net = (t: Tally) => (t.balls ? (t.runs - t.outs * wicket) / t.balls : usualNet);
  // Everyone else: their whole record less this duel, pulled towards the usual while it's small.
  const others = (t: Tally | undefined) => (t ? minus(t, x) : { balls: 0, runs: 0, outs: 0 });
  const batOthers = others(ctx?.batters.get(x.batterKey));
  const bowlOthers = others(ctx?.bowlers.get(x.bowlerKey));
  const steady = (t: Tally) => (net(t) * t.balls + usualNet * TRUST) / (t.balls + TRUST);
  const expected = (steady(batOthers) + steady(bowlOthers)) / 2;
  // How far this duel beats (or falls short of) that, a ball, trusted by how many balls there were.
  const gap = (net(x) - expected) * (x.balls / (x.balls + TRUST));
  const early = x.balls < BALLS_TO_CALL;
  const raw = 0.5 + Math.max(-0.45, Math.min(0.45, gap / 2.2));
  const side: Verdict['side'] = early || Math.abs(gap) < 0.22 ? 'even' : gap > 0 ? 'batter' : 'bowler';
  // The bar always leans the way the verdict goes, and only a little while it's early.
  const clampEven = (v: number) => Math.max(0.42, Math.min(0.58, v));
  const edge = side === 'batter' ? Math.max(raw, 0.6) : side === 'bowler' ? Math.min(raw, 0.4) : clampEven(raw);

  const usual = (t: Tally) => (t.balls >= BALLS_TO_CALL ? { sr: srOf(t), perOut: perOutOf(t), balls: t.balls } : null);
  const batterUsual = usual(batOthers);
  const bowlerUsual = usual(bowlOthers);
  const bat = first(x.batter);
  const bowl = first(x.bowler);
  const sr = srOf(x);
  const outs = x.outs ? `, out ${times(x.outs)}` : ', never out';
  const base = { edge, early, batterUsual, bowlerUsual };

  if (early) return { ...base, side, title: 'Too early to call', line: `${x.runs} off ${balls(x.balls)}${outs}. ${BALLS_TO_CALL - x.balls} more and it gets a verdict.` };
  if (side === 'batter') {
    const vs = batterUsual ? `, against ${batterUsual.sr.toFixed(0)} off everyone else` : '';
    return { ...base, side, title: `${bat} on top`, line: `Scores at a strike rate of ${sr.toFixed(0)} off ${bowl}${vs}${outs}.` };
  }
  if (side === 'bowler') {
    const every = x.outs ? `Gets ${bat} out every ${(x.balls / x.outs).toFixed(0)} balls` : `Holds ${bat} to a strike rate of ${sr.toFixed(0)}`;
    const vs = x.outs && batterUsual?.perOut ? `; everyone else needs ${batterUsual.perOut.toFixed(0)}` : !x.outs && batterUsual ? `, against ${batterUsual.sr.toFixed(0)} off everyone else` : '';
    return { ...base, side, title: `${bowl} on top`, line: `${every}${vs}.` };
  }
  return { ...base, side, title: 'Even contest', line: `${x.runs} off ${x.balls}${outs}: about what you'd expect from these two.` };
}
