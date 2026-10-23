import { matchState, oversText, type InningsState } from './engine.ts';
import { careerStats, COMMON_TEAM, keyFor, playerOfTheMatch } from './stats.ts';
import type { Match, Team } from './types.ts';

// The record book: the best (and worst) of every saved match. Only the two main innings count, not super overs.

type Where = { vs: string; date: number; matchId: string };
export type ScoreRecord = Where & { name: string; key: string; team: string; runs: number; balls: number; notOut: boolean };
export type BowlingRecord = Where & { name: string; key: string; team: string; wickets: number; runs: number; overs: string };
export type PartnershipRecord = Where & { names: string; team: string; runs: number; balls: number };
export type TotalRecord = Where & { team: string; runs: number; wickets: number; overs: string };
export type CountRecord = { name: string; key: string; team: string; count: number };
export type Matchup = { batter: string; bowler: string; balls: number; runs: number; outs: number };

const nameOf = (match: Match, id: string | null) => match.teams.flatMap((t) => t.players).find((p) => p.id === id)?.name ?? '';

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
    return st.innings.slice(0, 2).map((s, i) => ({ m, s, done: s.status === 'done', started: m.innings[i].events.length > 0 }));
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
    .map(({ m, s }) => ({ ...where(m, s), team: s.battingTeam.name, runs: s.runs, wickets: s.wickets, overs: oversText(s.legalBalls) }));

  const careers = careerStats(matches);
  const moms = new Map<string, CountRecord>();
  for (const m of matches) {
    const mom = playerOfTheMatch(m);
    if (!mom) continue;
    const r = moms.get(mom.key) ?? { name: mom.name, key: mom.key, team: mom.team, count: 0 };
    r.count += 1;
    moms.set(mom.key, r);
  }

  return {
    highScores: top(scores, (x) => x.runs * 1000 - x.balls),
    bestBowling: top(bowling, (x) => x.wickets * 1000 - x.runs),
    fastest: top(
      scores.filter((x) => x.balls >= 15),
      (x) => x.runs / x.balls,
    ),
    partnerships: top(partnerships, (x) => x.runs),
    highestTotals: top(totals, (x) => x.runs),
    lowestTotals: top(totals, (x) => -x.runs, 3),
    mostSixes: top(careers.filter((c) => c.batting.sixes), (c) => c.batting.sixes).map((c) => ({ name: c.name, key: c.key, team: c.team, count: c.batting.sixes })),
    mostDismissals: top(
      careers.filter((c) => c.fielding.catches + c.fielding.runOuts + c.fielding.stumpings),
      (c) => c.fielding.catches + c.fielding.runOuts + c.fielding.stumpings,
    ).map((c) => ({ name: c.name, key: c.key, team: c.team, count: c.fielding.catches + c.fielding.runOuts + c.fielding.stumpings })),
    mostMoM: top([...moms.values()], (x) => x.count),
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
export function matchups(matches: Match[]): Matchup[] {
  const pairs = new Map<string, Matchup>();
  for (const { m, s } of innings(matches)) {
    for (const d of s.log) {
      if (!d.striker || !d.bowler || d.ball.extra === 'wide') continue;
      const bat = sideOf(m, d.striker);
      const bowl = sideOf(m, d.bowler);
      if (!bat || !bowl) continue;
      const k = `${bat.key}>${bowl.key}`;
      const p = pairs.get(k) ?? { batter: nameOf(m, d.striker), bowler: nameOf(m, d.bowler), balls: 0, runs: 0, outs: 0 };
      p.balls += 1;
      if (!d.ball.extra || d.ball.extra === 'noball') p.runs += d.ball.runs;
      if (d.ball.wicket && d.ball.wicket.playerOut === d.striker && d.ball.wicket.kind !== 'runout' && d.ball.wicket.kind !== 'retired') p.outs += 1;
      pairs.set(k, p);
    }
  }
  return [...pairs.values()];
}
