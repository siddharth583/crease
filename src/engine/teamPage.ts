import { matchState } from './engine.ts';
import { keyFor } from './stats.ts';
import type { Match } from './types.ts';

// One side across every match it played under its name: its record, its form, its best and worst days, and who made
// its runs and took its wickets.

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export type TeamResult = { matchId: string; date: number; opponent: string; outcome: 'W' | 'L' | 'T' | 'D'; score: string; against: string; result: string };
export type TeamLeader = { key: string; name: string; value: number; sub: string };

export type TeamProfile = {
  name: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  drawn: number;
  /** Newest first. */
  results: TeamResult[];
  /** The longest run of wins or losses going now: 3 W, 2 L. */
  streak: { outcome: TeamResult['outcome']; count: number } | null;
  highest: { runs: number; wickets: number; matchId: string; opponent: string } | null;
  lowest: { runs: number; wickets: number; matchId: string; opponent: string } | null;
  /** Their average first-innings score, batting first or second. */
  averageScore: number | null;
  runs: TeamLeader[];
  wickets: TeamLeader[];
  sixes: TeamLeader[];
  catches: TeamLeader[];
};

export function teamProfile(matches: Match[], name: string): TeamProfile {
  const games = matches.filter((m) => m.teams.some((t) => same(t.name, name))).sort((a, b) => b.createdAt - a.createdAt);
  const results: TeamResult[] = [];
  let highest: TeamProfile['highest'] = null;
  let lowest: TeamProfile['lowest'] = null;
  let total = 0;
  let innings = 0;
  const bat = new Map<string, { name: string; runs: number; inns: number; sixes: number }>();
  const bowl = new Map<string, { name: string; wickets: number; runs: number; balls: number }>();
  const field = new Map<string, { name: string; catches: number }>();

  for (const m of games) {
    const st = matchState(m);
    const us = m.teams.find((t) => same(t.name, name))!;
    const them = m.teams.find((t) => t !== us)!;
    const key = (id: string) => {
      const p = us.players.find((x) => x.id === id);
      return p ? { key: keyFor(us, p), name: p.name.trim() } : null;
    };
    // The match itself, not its super over: the first two innings.
    const main = st.innings.slice(0, 2);
    const ours = main.find((s) => s.battingTeam.id === us.id);
    const theirs = main.find((s) => s.battingTeam.id === them.id);
    if (st.result) {
      const outcome = st.drawn ? 'D' : !st.winner ? 'T' : st.winner === us.id ? 'W' : 'L';
      results.push({
        matchId: m.id,
        date: m.createdAt,
        opponent: them.name.trim(),
        outcome,
        score: ours ? `${ours.runs}/${ours.wickets}` : '–',
        against: theirs ? `${theirs.runs}/${theirs.wickets}` : '–',
        result: st.result,
      });
      if (ours) {
        total += ours.runs;
        innings += 1;
        if (!highest || ours.runs > highest.runs) highest = { runs: ours.runs, wickets: ours.wickets, matchId: m.id, opponent: them.name.trim() };
        // A side bowled out or batting its overs out: a chase won early isn't a low score.
        const complete = outcome !== 'W' || ours !== main[1];
        if (complete && (!lowest || ours.runs < lowest.runs)) lowest = { runs: ours.runs, wickets: ours.wickets, matchId: m.id, opponent: them.name.trim() };
      }
    }
    for (const s of main) {
      if (s.battingTeam.id === us.id) {
        for (const b of s.batters) {
          const p = key(b.id);
          if (!p) continue;
          const line = bat.get(p.key) ?? { name: p.name, runs: 0, inns: 0, sixes: 0 };
          line.runs += b.runs;
          line.inns += 1;
          line.sixes += b.sixes;
          bat.set(p.key, line);
        }
      } else {
        for (const b of s.bowlers) {
          const p = key(b.id);
          if (!p) continue;
          const line = bowl.get(p.key) ?? { name: p.name, wickets: 0, runs: 0, balls: 0 };
          line.wickets += b.wickets;
          line.runs += b.runs;
          line.balls += b.balls;
          bowl.set(p.key, line);
        }
        for (const b of s.batters) {
          if (b.out?.kind !== 'caught' || !b.out.fielder) continue;
          const p = key(b.out.fielder);
          if (!p) continue;
          const line = field.get(p.key) ?? { name: p.name, catches: 0 };
          line.catches += 1;
          field.set(p.key, line);
        }
      }
    }
  }

  let streak: TeamProfile['streak'] = null;
  for (const r of results) {
    if (!streak) streak = { outcome: r.outcome, count: 1 };
    else if (r.outcome === streak.outcome) streak.count += 1;
    else break;
  }
  const top = <T,>(map: Map<string, T>, value: (x: T) => number, sub: (x: T) => string) =>
    [...map.entries()]
      .filter(([, x]) => value(x) > 0)
      .sort((a, b) => value(b[1]) - value(a[1]))
      .slice(0, 3)
      .map(([key, x]) => ({ key, name: (x as { name: string }).name, value: value(x), sub: sub(x) }));
  const overs = (balls: number) => `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ''} ov`;

  return {
    name: games[0]?.teams.find((t) => same(t.name, name))?.name.trim() ?? name.trim(),
    played: results.length,
    won: results.filter((r) => r.outcome === 'W').length,
    lost: results.filter((r) => r.outcome === 'L').length,
    tied: results.filter((r) => r.outcome === 'T').length,
    drawn: results.filter((r) => r.outcome === 'D').length,
    results,
    streak,
    highest,
    lowest,
    averageScore: innings ? total / innings : null,
    runs: top(bat, (x) => x.runs, (x) => `${x.inns} inn${x.inns === 1 ? '' : 's'}`),
    wickets: top(bowl, (x) => x.wickets, (x) => `${overs(x.balls)} · ${x.runs} runs`),
    sixes: top(bat, (x) => x.sixes, (x) => `${x.runs} runs`),
    catches: top(field, (x) => x.catches, () => ''),
  };
}
