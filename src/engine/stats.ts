import { matchState, oversText } from './engine.ts';
import type { Match, Team } from './types.ts';

// Career numbers across every saved match. A player is the same person when the team name and player name
// match (ignoring case and spaces), which also works for matches scored before squads were saved.

export type MatchLine = {
  matchId: string;
  date: number;
  opponent: string;
  bat?: { runs: number; balls: number; notOut: boolean };
  bowl?: { balls: number; runs: number; wickets: number };
  won: boolean | null;
};

export type Career = {
  key: string;
  name: string;
  team: string;
  matches: number;
  batting: {
    innings: number;
    notOuts: number;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    highest: number;
    highestNotOut: boolean;
    fifties: number;
    ducks: number;
  };
  bowling: { innings: number; balls: number; runs: number; wickets: number; maidens: number; best: { wickets: number; runs: number } | null };
  fielding: { catches: number; runOuts: number; stumpings: number };
  history: MatchLine[];
};

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Names the setup screen fills in for blanks: these could be anyone, so they get no career. */
export const isPlaceholder = (name: string) => /^player \d+$/.test(norm(name));

export const playerKey = (team: Team, name: string) => `${norm(team.name)}|${norm(name)}`;

/** A common player (plays for both sides) is one person, whichever side they turned out for. */
export const COMMON_TEAM = 'Both teams';
export const keyFor = (team: Team, p: { name: string; common?: boolean }) =>
  p.common ? `common|${norm(p.name)}` : playerKey(team, p.name);

export const battingAverage = (c: Career) => {
  const outs = c.batting.innings - c.batting.notOuts;
  return outs > 0 ? c.batting.runs / outs : null;
};
export const strikeRate = (c: Career) => (c.batting.balls ? (c.batting.runs * 100) / c.batting.balls : null);
export const economy = (c: Career) => (c.bowling.balls ? (c.bowling.runs * 6) / c.bowling.balls : null);
export const bowlingAverage = (c: Career) => (c.bowling.wickets ? c.bowling.runs / c.bowling.wickets : null);
export const bestFigures = (c: Career) => (c.bowling.best ? `${c.bowling.best.wickets}/${c.bowling.best.runs}` : '–');
export const bowlingOvers = (c: Career) => oversText(c.bowling.balls);

export function careerStats(matches: Match[]): Career[] {
  const careers = new Map<string, Career>();

  for (const match of [...matches].sort((a, b) => a.createdAt - b.createdAt)) {
    const state = matchState(match);
    const idToKey = new Map<string, string>();

    for (const team of match.teams) {
      const opponent = match.teams.find((t) => t !== team)!;
      for (const p of team.players) {
        if (isPlaceholder(p.name)) continue;
        const key = keyFor(team, p);
        idToKey.set(p.id, key);
        let c = careers.get(key);
        if (!c) {
          c = {
            key,
            name: p.name.trim(),
            team: team.name.trim(),
            matches: 0,
            batting: { innings: 0, notOuts: 0, runs: 0, balls: 0, fours: 0, sixes: 0, highest: 0, highestNotOut: false, fifties: 0, ducks: 0 },
            bowling: { innings: 0, balls: 0, runs: 0, wickets: 0, maidens: 0, best: null },
            fielding: { catches: 0, runOuts: 0, stumpings: 0 },
            history: [],
          };
          careers.set(key, c);
        }
        // Latest spelling wins for display.
        c.name = p.name.trim();
        c.team = p.common ? COMMON_TEAM : team.name.trim();
        // A common player is in both squads: one match, not two.
        if (c.history[0]?.matchId === match.id) continue;
        c.matches += 1;
        c.history.unshift({
          matchId: match.id,
          date: match.createdAt,
          opponent: opponent.name,
          won: state.result ? state.winner === team.id : null,
        });
      }
    }

    const lineFor = (id: string) => {
      const key = idToKey.get(id);
      const c = key ? careers.get(key) : undefined;
      return c ? { c, line: c.history[0] } : null;
    };

    for (const inn of state.innings.slice(0, 2)) {
      for (const b of inn.batters) {
        const hit = lineFor(b.id);
        if (!hit) continue;
        const { c, line } = hit;
        const notOut = !b.out;
        c.batting.innings += 1;
        if (notOut) c.batting.notOuts += 1;
        c.batting.runs += b.runs;
        c.batting.balls += b.balls;
        c.batting.fours += b.fours;
        c.batting.sixes += b.sixes;
        if (b.runs > c.batting.highest || (b.runs === c.batting.highest && notOut)) {
          c.batting.highest = b.runs;
          c.batting.highestNotOut = notOut;
        }
        if (b.runs >= 50) c.batting.fifties += 1;
        if (b.runs === 0 && b.out) c.batting.ducks += 1;
        line.bat = { runs: b.runs, balls: b.balls, notOut };

        if (b.out?.fielder) {
          const f = lineFor(b.out.fielder);
          if (f) {
            if (b.out.kind === 'caught') f.c.fielding.catches += 1;
            if (b.out.kind === 'runout') f.c.fielding.runOuts += 1;
            if (b.out.kind === 'stumped') f.c.fielding.stumpings += 1;
          }
        }
      }

      for (const bw of inn.bowlers) {
        const hit = lineFor(bw.id);
        if (!hit || (bw.balls === 0 && bw.runs === 0)) continue;
        const { c, line } = hit;
        c.bowling.innings += 1;
        c.bowling.balls += bw.balls;
        c.bowling.runs += bw.runs;
        c.bowling.wickets += bw.wickets;
        c.bowling.maidens += bw.maidens;
        const best = c.bowling.best;
        if (!best || bw.wickets > best.wickets || (bw.wickets === best.wickets && bw.runs < best.runs))
          c.bowling.best = { wickets: bw.wickets, runs: bw.runs };
        line.bowl = { balls: bw.balls, runs: bw.runs, wickets: bw.wickets };
      }
    }
  }

  return [...careers.values()];
}

export type PlayerOfMatch = { id: string; key: string; name: string; team: string; summary: string };

type Impact = {
  id: string;
  key: string;
  name: string;
  team: string;
  score: number;
  runs: number;
  balls: number;
  notOut: boolean;
  batted: boolean;
  wickets: number;
  conceded: number;
  bowled: boolean;
  field: number;
};

/**
 * How much each player did in one finished match: runs (with a nudge for scoring fast), 20 a wicket, 5 a maiden,
 * 8 a catch, run out or stumping, and a tenth more for the winning side.
 */
function impacts(match: Match): Impact[] {
  const state = matchState(match);
  if (!state.result) return [];
  const lines = new Map<string, Impact>();
  const line = (id: string) => {
    let l = lines.get(id);
    if (!l) {
      const team = match.teams.find((t) => t.players.some((p) => p.id === id))!;
      const name = team.players.find((p) => p.id === id)!.name;
      const p = team.players.find((x) => x.id === id)!;
      l = { id, key: keyFor(team, p), name, team: p.common ? COMMON_TEAM : team.name, score: 0, runs: 0, balls: 0, notOut: false, batted: false, wickets: 0, conceded: 0, bowled: false, field: 0 };
      lines.set(id, l);
    }
    return l;
  };
  for (const inn of state.innings.slice(0, 2)) {
    for (const b of inn.batters) {
      const l = line(b.id);
      const sr = b.balls ? (b.runs * 100) / b.balls : 0;
      l.score += b.runs + (b.balls >= 6 ? Math.max(0, (sr - 100) / 20) : 0);
      Object.assign(l, { runs: b.runs, balls: b.balls, notOut: !b.out, batted: true });
      if (b.out?.fielder) {
        const f = line(b.out.fielder);
        f.score += 8;
        f.field += 1;
      }
    }
    for (const bw of inn.bowlers) {
      if (!bw.balls && !bw.runs) continue;
      const l = line(bw.id);
      l.score += bw.wickets * 20 + bw.maidens * 5;
      Object.assign(l, { wickets: bw.wickets, conceded: bw.runs, bowled: true });
    }
  }
  const winner = match.teams.find((t) => t.id === state.winner);
  for (const l of lines.values()) if (winner && l.team === winner.name) l.score *= 1.1;
  return [...lines.values()];
}

/** Man of the Match: the biggest impact in a finished match. */
export function playerOfTheMatch(match: Match): PlayerOfMatch | null {
  const best = impacts(match).sort((a, b) => b.score - a.score)[0];
  if (!best || best.score <= 0) return null;
  const parts = [
    best.batted ? `${best.runs}${best.notOut ? '*' : ''} (${best.balls})` : '',
    best.bowled ? `${best.wickets}/${best.conceded}` : '',
    best.field ? `${best.field} in the field` : '',
  ].filter(Boolean);
  return { id: best.id, key: best.key, name: best.name, team: best.team, summary: parts.join('  ·  ') };
}

// ─── Series ──────────────────────────────────────────────────────────────────

export type SeriesState = {
  id: string;
  name: string;
  of: number;
  /** Team names, in the order of the first match. */
  teams: [string, string];
  matches: Match[];
  played: number;
  wins: [number, number];
  ties: number;
  /** The team that has won it, once one can't be caught. */
  winner: string | null;
  over: boolean;
  status: string;
  /** Number of the next match to play, or null if the series is over or a match is still being played. */
  next: number | null;
  /** Man of the Series so far (final once the series is over). */
  best: { key: string; name: string; team: string; summary: string } | null;
};

/** Every series among these matches, newest first. */
export function allSeries(matches: Match[]): SeriesState[] {
  const ids = [...new Set(matches.filter((m) => m.series).map((m) => m.series!.id))];
  return ids
    .map((id) => seriesState(matches.filter((m) => m.series?.id === id)))
    .sort((a, b) => b.matches[b.matches.length - 1].createdAt - a.matches[a.matches.length - 1].createdAt);
}

export function seriesState(seriesMatches: Match[]): SeriesState {
  const matches = [...seriesMatches].sort((a, b) => a.series!.number - b.series!.number);
  const info = matches[0].series!;
  const teams: [string, string] = [matches[0].teams[0].name, matches[0].teams[1].name];
  const wins: [number, number] = [0, 0];
  let ties = 0;
  let played = 0;
  let live = false;
  const totals = new Map<string, Impact & { matches: number }>();

  for (const m of matches) {
    const st = matchState(m);
    if (!st.result) {
      live = true;
      continue;
    }
    played += 1;
    const winner = m.teams.find((t) => t.id === st.winner)?.name;
    if (!winner) ties += 1;
    else wins[norm(winner) === norm(teams[0]) ? 0 : 1] += 1;
    for (const i of impacts(m)) {
      const t = totals.get(i.key);
      if (!t) totals.set(i.key, { ...i, matches: 1 });
      else {
        t.score += i.score;
        t.runs += i.runs;
        t.wickets += i.wickets;
        t.field += i.field;
        t.matches += 1;
        t.name = i.name;
      }
    }
  }

  const needed = Math.floor(info.of / 2) + 1;
  const leaderIdx = wins[0] > wins[1] ? 0 : wins[1] > wins[0] ? 1 : null;
  const winner = leaderIdx !== null && wins[leaderIdx] >= needed ? teams[leaderIdx] : null;
  const over = winner !== null || played >= info.of;
  const [hi, lo] = [Math.max(...wins), Math.min(...wins)];
  const status = winner
    ? `${winner} win the series ${hi}–${lo}`
    : over
      ? `Series drawn ${hi}–${lo}`
      : played === 0
        ? `First to ${needed} wins`
        : leaderIdx === null
          ? `Series level ${hi}–${lo}`
          : `${teams[leaderIdx]} lead ${hi}–${lo}`;

  const top = [...totals.values()].sort((a, b) => b.score - a.score)[0];
  const best =
    top && top.score > 0
      ? {
          key: top.key,
          name: top.name,
          team: top.team,
          summary: [
            top.runs ? `${top.runs} runs` : '',
            top.wickets ? `${top.wickets} wicket${top.wickets === 1 ? '' : 's'}` : '',
            `${top.matches} match${top.matches === 1 ? '' : 'es'}`,
          ]
            .filter(Boolean)
            .join(' · '),
        }
      : null;

  const lastNumber = Math.max(...matches.map((m) => m.series!.number));
  return {
    id: info.id,
    name: info.name,
    of: info.of,
    teams,
    matches,
    played,
    wins,
    ties,
    winner,
    over,
    status,
    next: over || live ? null : lastNumber + 1,
    best,
  };
}
