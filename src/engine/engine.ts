import { dlsTarget } from './dls.ts';
import type { BallEvent, Extra, Innings, InningsEvent, Match, Rules, Team, WicketKind } from './types.ts';

// Everything on screen is derived from the innings' event list, so undo is just "drop the last event".

export type BatterLine = {
  id: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out?: { kind: WicketKind; bowler: string | null; fielder?: string };
  retired?: boolean;
};

export type BowlerLine = {
  id: string;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
  wides: number;
  noballs: number;
  /** Boundaries hit off them: off the bat, as the batter is credited (byes and wides aren't). */
  fours: number;
  sixes: number;
};

export type BallTone = 'dot' | 'run' | 'four' | 'six' | 'wicket' | 'extra';
/** `event` is the delivery's index in its innings' events, so the ball can be edited later. */
export type BallView = { label: string; tone: BallTone; event?: number; wicket?: boolean; bowler?: string | null };

export type DeliveryLog = {
  /** e.g. "3.4": the over and the ball of it. */
  over: string;
  bowler: string | null;
  striker: string | null;
  /** The delivery as it counted (a called bouncer shows as its wide or no-ball). */
  ball: BallEvent;
  /** Runs it added to the total. */
  total: number;
  label: string;
};

export type InningsStatus = 'openers' | 'batter' | 'bowler' | 'live' | 'done';

export type InningsState = {
  battingTeam: Team;
  bowlingTeam: Team;
  runs: number;
  wickets: number;
  legalBalls: number;
  maxBalls: number;
  extras: Record<Extra | 'penalty', number>;
  striker: string | null;
  nonStriker: string | null;
  bowler: string | null;
  lastOverBowler: string | null;
  /** Who bowled the last finished over, all of them if it was split: none of them may bowl the next one. */
  barred: string[];
  batters: BatterLine[];
  bowlers: BowlerLine[];
  fallOfWickets: { wicket: number; runs: number; over: string; player: string }[];
  overs: BallView[][];
  /** Runs and wickets in each over, in step with `overs`. */
  overTotals: { runs: number; wickets: number }[];
  /** The bowlers of each over in the order they bowled in it (two when one couldn't finish it), in step with `overs`. */
  overBowlers: string[][];
  partnership: { runs: number; balls: number };
  /** Every partnership in order; the last one is still going while the innings is. */
  partnerships: { batters: [string | null, string | null]; runs: number; balls: number }[];
  /** Ball by ball, for the commentary and batter-against-bowler records. */
  log: DeliveryLog[];
  available: string[];
  target: number | null;
  status: InningsStatus;
  /** Wicket-taking deliveries in a row, per bowler (wides and no-balls don't break a run). */
  streaks: Record<string, number>;
  /** The next delivery is a free hit. */
  freeHit: boolean;
  /** Bouncers bowled so far in the current over. */
  bouncersThisOver: number;
  endedEarly: boolean;
};

export type MatchState = {
  innings: InningsState[];
  current: number;
  result: string | null;
  winner: string | null;
};

export const BOWLER_WICKETS: WicketKind[] = ['bowled', 'caught', 'lbw', 'stumped', 'hitwicket'];

export const oversText = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

export const allOutAt = (rules: Rules, team: Team) =>
  rules.lastManStands ? team.players.length : team.players.length - 1;

const isLegal = (rules: Rules, extra?: Extra) => !(rules.reball && (extra === 'wide' || extra === 'noball'));

export function ballView(rules: Rules, ball: BallEvent): BallView {
  if (ball.wicket && ball.wicket.kind !== 'retired') return { label: 'W', tone: 'wicket' };
  const plus = ball.runs ? `+${ball.runs}` : '';
  switch (ball.extra) {
    case 'wide':
      return { label: `Wd${plus}`, tone: 'extra' };
    case 'noball':
      return { label: `Nb${plus}`, tone: 'extra' };
    case 'bye':
      return { label: `${ball.runs}b`, tone: 'extra' };
    case 'legbye':
      return { label: `${ball.runs}lb`, tone: 'extra' };
  }
  if (ball.runs === 0) return { label: '•', tone: 'dot' };
  if (ball.runs === 4) return { label: '4', tone: 'four' };
  if (ball.runs === 6) return { label: '6', tone: 'six' };
  return { label: String(ball.runs), tone: 'run' };
}

/**
 * The overs an innings is played over. A cut made during the chase doesn't reach back: the first innings keeps the
 * overs it had when the chase began.
 */
function oversFor(match: Match, index: number): number {
  const chaseCut = index === 0 ? (match.interruptions ?? []).find((c) => c.innings === 1) : undefined;
  return chaseCut ? chaseCut.before : match.rules.overs;
}

export function inningsState(match: Match, index: number, target: number | null): InningsState {
  const { rules } = match;
  const innings = match.innings[index];
  const battingTeam = teamById(match, innings.battingTeam);
  const bowlingTeam = teamById(match, innings.bowlingTeam);
  // A super over (innings 3 and 4) is one over, and two wickets end it.
  const limit = index >= 2 ? Math.min(2, allOutAt(rules, battingTeam)) : allOutAt(rules, battingTeam);

  const s: InningsState = {
    battingTeam,
    bowlingTeam,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    maxBalls: index >= 2 ? 6 : oversFor(match, index) * 6,
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0, penalty: 0 },
    striker: null,
    nonStriker: null,
    bowler: null,
    lastOverBowler: null,
    barred: [],
    batters: [],
    bowlers: [],
    fallOfWickets: [],
    overs: [[]],
    overTotals: [{ runs: 0, wickets: 0 }],
    overBowlers: [[]],
    partnership: { runs: 0, balls: 0 },
    partnerships: [],
    log: [],
    available: [],
    target,
    status: 'openers',
    streaks: {},
    freeHit: false,
    bouncersThisOver: 0,
    endedEarly: false,
  };
  let opened = false;
  let overConceded = 0;

  const batter = (id: string) => {
    let line = s.batters.find((b) => b.id === id);
    if (!line) s.batters.push((line = { id, runs: 0, balls: 0, fours: 0, sixes: 0 }));
    return line;
  };
  const bowler = (id: string) => {
    let line = s.bowlers.find((b) => b.id === id);
    if (!line) s.bowlers.push((line = { id, balls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noballs: 0, fours: 0, sixes: 0 }));
    return line;
  };
  const swap = () => ([s.striker, s.nonStriker] = [s.nonStriker, s.striker]);

  let bouncersThisOver = 0;
  for (const [eventIndex, event] of innings.events.entries()) {
    let e = event;
    if (e.type === 'endInnings') {
      s.endedEarly = true;
      continue;
    }
    if (e.type === 'deadBall') continue;
    if (e.type === 'penalty') {
      s.runs += e.runs;
      s.extras.penalty += e.runs;
      continue;
    }
    if (e.type === 'openers') {
      opened = true;
      s.striker = e.striker;
      s.nonStriker = e.nonStriker;
      batter(e.striker);
      batter(e.nonStriker);
      continue;
    }
    if (e.type === 'bowler') {
      s.bowler = e.bowler;
      bowler(e.bowler);
      continue;
    }
    if (e.type === 'retire') {
      const line = batter(e.batter);
      if (e.out) {
        s.wickets += 1;
        // Between overs it goes with the over just bowled.
        const o = s.overs[s.overs.length - 1].length === 0 && s.overTotals.length > 1 ? s.overTotals.length - 2 : s.overTotals.length - 1;
        s.overTotals[o].wickets += 1;
        line.out = { kind: 'retiredout', bowler: null };
        line.retired = false;
        s.fallOfWickets.push({ wicket: s.wickets, runs: s.runs, over: oversText(s.legalBalls), player: line.id });
      } else line.retired = true;
      s.partnerships.push({ batters: [s.striker, s.nonStriker], ...s.partnership });
      if (s.striker === e.batter) s.striker = null;
      if (s.nonStriker === e.batter) s.nonStriker = null;
      s.partnership = { runs: 0, balls: 0 };
      continue;
    }
    if (e.type === 'swap') {
      swap();
      continue;
    }
    if (e.type === 'batter') {
      const line = batter(e.batter);
      line.retired = false;
      if (s.striker === null) s.striker = e.batter;
      else s.nonStriker = e.batter;
      continue;
    }

    // Last man standing: the lone batter faces every ball, however the runs or the over end left the ends.
    if (rules.lastManStands && s.striker === null && s.nonStriker !== null) [s.striker, s.nonStriker] = [s.nonStriker, null];

    // A delivery. Within the over's allowance a bounce is the umpire's call (fair or wide); past it, it's
    // called by the rule (usually a no-ball).
    let calledBouncer = false;
    if (e.bouncer) {
      if (bouncersThisOver >= (rules.bouncer?.fair ?? 1)) {
        e = { ...e, extra: rules.bouncer?.calledAs ?? 'noball' };
        calledBouncer = true;
      } else if (e.bouncer === 'wide') {
        e = { ...e, extra: 'wide' };
        calledBouncer = true;
      }
      bouncersThisOver += 1;
    }
    const legal = e.counts ?? isLegal(rules, e.extra);
    const penalty = e.extra === 'wide' || e.extra === 'noball' ? rules.extraRun : 0;
    const total = e.runs + penalty;
    s.runs += total;
    s.partnership.runs += total;

    if (s.striker) {
      const striker = batter(s.striker);
      if (e.extra !== 'wide') {
        striker.balls += 1;
        s.partnership.balls += 1;
      }
      if (!e.extra || e.extra === 'noball') {
        striker.runs += e.runs;
        if (e.runs === 4) striker.fours += 1;
        if (e.runs === 6) striker.sixes += 1;
      }
    }

    if (e.extra === 'wide') s.extras.wide += total;
    else if (e.extra === 'noball') s.extras.noball += penalty;
    else if (e.extra) s.extras[e.extra] += e.runs;

    const bowlerId = s.bowler;
    if (bowlerId) {
      const line = bowler(bowlerId);
      const conceded = e.extra === 'bye' || e.extra === 'legbye' ? 0 : total;
      line.runs += conceded;
      overConceded += conceded;
      if (legal) line.balls += 1;
      if (e.extra === 'wide') line.wides += 1;
      if (e.extra === 'noball') line.noballs += 1;
      if (!e.extra || e.extra === 'noball') {
        if (e.runs === 4) line.fours += 1;
        if (e.runs === 6) line.sixes += 1;
      }
      const these = s.overBowlers[s.overBowlers.length - 1];
      if (!these.includes(bowlerId)) these.push(bowlerId);
    }

    const view =
      calledBouncer && !e.wicket
        ? { label: `B${e.extra === 'wide' ? 'Wd' : 'Nb'}${e.runs ? `+${e.runs}` : ''}`, tone: 'extra' as const }
        : ballView(rules, e);
    s.log.push({
      over: `${Math.floor(s.legalBalls / 6)}.${(s.legalBalls % 6) + 1}`,
      bowler: bowlerId,
      striker: s.striker,
      ball: e,
      total,
      label: view.label,
    });
    s.overs[s.overs.length - 1].push({ ...view, event: eventIndex, wicket: Boolean(e.wicket), bowler: bowlerId });
    s.freeHit = Boolean(rules.freeHit) && (e.extra === 'noball' || (s.freeHit && e.extra === 'wide'));
    const overTotal = s.overTotals[s.overTotals.length - 1];
    overTotal.runs += total;
    if (e.wicket && e.wicket.kind !== 'retired') overTotal.wickets += 1;

    // Runs first (batters cross), then the wicket leaves a gap where that batter now stands.
    if (e.runs % 2 === 1) swap();
    if (e.wicket) {
      const out = batter(e.wicket.playerOut);
      if (e.wicket.kind === 'retired') {
        out.retired = true;
      } else {
        s.wickets += 1;
        out.out = { kind: e.wicket.kind, bowler: bowlerId, fielder: e.wicket.fielder };
        if (bowlerId && BOWLER_WICKETS.includes(e.wicket.kind)) {
          bowler(bowlerId).wickets += 1;
          s.streaks[bowlerId] = (s.streaks[bowlerId] ?? 0) + 1;
        }
        s.fallOfWickets.push({
          wicket: s.wickets,
          runs: s.runs,
          over: oversText(s.legalBalls + (legal ? 1 : 0)),
          player: out.id,
        });
      }
      s.partnerships.push({ batters: [s.striker ?? out.id, s.nonStriker], ...s.partnership });
      if (s.striker === out.id) s.striker = null;
      if (s.nonStriker === out.id) s.nonStriker = null;
      s.partnership = { runs: 0, balls: 0 };
    }

    const bowlersWicket = e.wicket && BOWLER_WICKETS.includes(e.wicket.kind);
    if (bowlerId && legal && !bowlersWicket) s.streaks[bowlerId] = 0;

    if (legal) {
      s.legalBalls += 1;
      if (s.legalBalls % 6 === 0) {
        // A maiden is one bowler's whole over: an over split between two isn't anyone's maiden.
        const these = s.overBowlers[s.overBowlers.length - 1];
        if (bowlerId && overConceded === 0 && these.length === 1) bowler(bowlerId).maidens += 1;
        overConceded = 0;
        swap();
        s.lastOverBowler = bowlerId;
        s.barred = these;
        s.overBowlers.push([]);

        s.bowler = null;
        s.overs.push([]);
        bouncersThisOver = 0;
        s.overTotals.push({ runs: 0, wickets: 0 });
      }
    }
  }

  const atCrease = [s.striker, s.nonStriker];
  s.available = battingTeam.players
    .map((p) => p.id)
    .filter((id) => {
      const line = s.batters.find((b) => b.id === id);
      return !atCrease.includes(id) && (!line || line.retired);
    });

  // Last man standing: with nobody left to come in, the lone batter keeps the strike.
  if (rules.lastManStands && s.available.length === 0 && s.striker === null && s.nonStriker !== null) {
    s.striker = s.nonStriker;
    s.nonStriker = null;
  }

  const gap = opened && (s.striker === null || s.nonStriker === null);
  const stranded = gap && s.available.length === 0 && (!rules.lastManStands || s.striker === null);
  if (
    s.endedEarly ||
    s.legalBalls >= s.maxBalls ||
    s.wickets >= limit ||
    (target !== null && s.runs >= target) ||
    stranded
  )
    s.status = 'done';
  else if (!opened) s.status = 'openers';
  else if (gap && s.available.length > 0) s.status = 'batter';
  else if (s.bowler === null) s.status = 'bowler';
  else s.status = 'live';

  s.bouncersThisOver = bouncersThisOver;
  if (opened && (s.partnership.runs || s.partnership.balls || s.striker || s.nonStriker))
    s.partnerships.push({ batters: [s.striker, s.nonStriker], ...s.partnership });
  if (s.status === 'done') s.freeHit = false;
  if (s.overs.length > 1 && s.overs[s.overs.length - 1].length === 0 && s.status === 'done') {
    s.overs.pop();
    s.overTotals.pop();
    s.overBowlers.pop();
  }
  return s;
}

/** How the chase target was set: agreed by hand, by DLS after lost overs, or simply the first innings plus one. */
export function chaseTargetInfo(match: Match, firstRuns: number): { target: number; method: 'normal' | 'dls' | 'agreed' } {
  if (match.revisedTarget) return { target: match.revisedTarget, method: 'agreed' };
  if (match.interruptions?.length) {
    const { target } = dlsTarget({
      firstRuns,
      originalOvers: match.originalOvers ?? match.rules.overs,
      interruptions: match.interruptions,
      g: match.dlsG ?? 8 * (match.originalOvers ?? match.rules.overs),
      sideSize: match.rules.playersPerSide,
    });
    return { target, method: 'dls' };
  }
  return { target: firstRuns + 1, method: 'normal' };
}

export const chaseTarget = (match: Match, firstRuns: number) => chaseTargetInfo(match, firstRuns).target;

export function matchState(match: Match): MatchState {
  const first = inningsState(match, 0, null);
  const { target, method } = chaseTargetInfo(match, first.runs);
  const tag = method === 'dls' ? ' (DLS)' : '';
  const second = inningsState(match, 1, target);
  const innings = [first, second];
  let current = first.status === 'done' ? 1 : 0;

  let result: string | null = null;
  let winner: string | null = null;
  if (first.status === 'done' && second.status === 'done') {
    if (second.runs >= target) {
      const left = allOutAt(match.rules, second.battingTeam) - second.wickets;
      winner = second.battingTeam.id;
      result = `${second.battingTeam.name} won by ${left} wicket${left === 1 ? '' : 's'}${tag}`;
    } else if (second.runs === target - 1) {
      result = 'Match tied';
    } else {
      const margin = target - 1 - second.runs;
      winner = first.battingTeam.id;
      result = `${first.battingTeam.name} won by ${margin} run${margin === 1 ? '' : 's'}${tag}`;
    }

    // A tie goes to a super over once one is started: the side that batted second bats first.
    if (result === 'Match tied' && match.innings.length >= 4) {
      const so1 = inningsState(match, 2, null);
      const so2 = inningsState(match, 3, so1.runs + 1);
      innings.push(so1, so2);
      current = so1.status === 'done' ? 3 : 2;
      result = null;
      if (so1.status === 'done' && so2.status === 'done') {
        if (so2.runs > so1.runs) {
          winner = so2.battingTeam.id;
          result = `${so2.battingTeam.name} won the super over`;
        } else if (so2.runs === so1.runs) {
          result = 'Tied, and the super over too';
        } else {
          winner = so1.battingTeam.id;
          result = `${so1.battingTeam.name} won the super over`;
        }
      }
    }
  }
  return { innings, current, result, winner };
}

/** Start a super over after a tie: the side that batted second bats first. */
export function startSuperOver(match: Match): Match {
  if (match.innings.length >= 4 || matchState(match).result !== 'Match tied') return match;
  const [first, second] = match.innings;
  return {
    ...match,
    innings: [
      ...match.innings,
      { battingTeam: second.battingTeam, bowlingTeam: first.battingTeam, events: [] },
      { battingTeam: first.battingTeam, bowlingTeam: second.battingTeam, events: [] },
    ],
  };
}

/** Add a late arrival (or substitute) to a side mid-match. */
export function addPlayer(match: Match, teamId: string, player: { id: string; name: string }): Match {
  return {
    ...match,
    teams: match.teams.map((t) => (t.id === teamId ? { ...t, players: [...t.players, player] } : t)) as [Team, Team],
  };
}

/**
 * Move a player to the other side mid-match (sides rebalanced, someone's needed elsewhere). Only someone who hasn't
 * batted or bowled yet can move: anything they've done counts for the side they did it for. Captaincy or keeping for
 * their old side goes. The new match, or why the move can't be made.
 */
export function movePlayer(match: Match, playerId: string): Match | string {
  const from = match.teams.find((t) => t.players.some((p) => p.id === playerId));
  if (!from) return 'That player isn’t in this match.';
  const player = from.players.find((p) => p.id === playerId)!;
  if (player.common) return `${player.name} already plays for both sides.`;
  const to = match.teams.find((t) => t !== from)!;
  const state = matchState(match);
  const played = state.innings.some((inn) => inn.batters.some((b) => b.id === playerId) || inn.bowlers.some((b) => b.id === playerId));
  if (played) return `${player.name} has already batted or bowled for ${from.name}, so stays with them.`;
  if (from.players.length <= 2) return `${from.name} would be left with only ${from.players.length - 1}.`;
  const without = <T extends Record<string, string> | undefined>(marks: T) =>
    marks && marks[from.id] === playerId ? (Object.fromEntries(Object.entries(marks).filter(([k]) => k !== from.id)) as T) : marks;
  return {
    ...match,
    teams: match.teams.map((t) =>
      t === from ? { ...t, players: t.players.filter((p) => p.id !== playerId) } : { ...t, players: [...t.players, player] },
    ) as [Team, Team],
    captains: without(match.captains),
    keepers: without(match.keepers),
  };
}

/**
 * Rename a player in this match (a typo, a nickname, a full name). Their balls stay theirs: only the name changes, so
 * the scorecard, the stats and the records follow it. The common player is renamed on both sides. Null if the new
 * name is empty or the player isn't here.
 */
export function renamePlayer(match: Match, playerId: string, name: string): Match | null {
  const clean = name.trim().replace(/\s+/g, ' ');
  const player = match.teams.flatMap((t) => t.players).find((p) => p.id === playerId);
  if (!clean || !player) return null;
  if (clean === player.name) return match;
  const same = (p: { id: string; name: string; common?: boolean }) => p.id === playerId || (player.common && p.common && p.name === player.name);
  return {
    ...match,
    teams: match.teams.map((t) => ({ ...t, players: t.players.map((p) => (same(p) ? { ...p, name: clean } : p)) })) as [Team, Team],
  };
}

export function teamById(match: Match, id: string): Team {
  const team = match.teams.find((t) => t.id === id);
  if (!team) throw new Error(`Unknown team ${id}`);
  return team;
}

export function playerName(match: Match, id: string | null | undefined): string {
  if (!id) return '';
  for (const t of match.teams) {
    const p = t.players.find((x) => x.id === id);
    if (p) return p.name;
  }
  return '?';
}

export function dismissal(match: Match, line: BatterLine): string {
  if (line.retired) return 'retired hurt';
  if (!line.out) return 'not out';
  const b = playerName(match, line.out.bowler);
  const f = playerName(match, line.out.fielder);
  switch (line.out.kind) {
    case 'bowled':
      return `b ${b}`;
    case 'caught':
      return line.out.fielder === line.out.bowler ? `c & b ${b}` : `c ${f || 'sub'} b ${b}`;
    case 'lbw':
      return `lbw b ${b}`;
    case 'stumped':
      return `st ${f || 'keeper'} b ${b}`;
    case 'hitwicket':
      return `hit wicket b ${b}`;
    case 'runout':
      return f ? `run out (${f})` : 'run out';
    case 'retiredout':
      return 'retired out';
    default:
      return 'retired hurt';
  }
}

/** First innings bats the toss winner if they chose to bat, otherwise the other side. */
export function newMatch(id: string, teams: [Team, Team], rules: Rules, toss: Match['toss']): Match {
  const tossTeam = teams.find((t) => t.id === toss.winner) ?? teams[0];
  const other = teams.find((t) => t !== tossTeam) ?? teams[1];
  const [bat, bowl] = toss.choice === 'bat' ? [tossTeam, other] : [other, tossTeam];
  return {
    id,
    createdAt: Date.now(),
    teams,
    rules,
    toss,
    innings: [
      { battingTeam: bat.id, bowlingTeam: bowl.id, events: [] },
      { battingTeam: bowl.id, bowlingTeam: bat.id, events: [] },
    ],
  };
}

export function addEvent(match: Match, event: InningsEvent): Match {
  const { current, result } = matchState(match);
  if (result) return match;
  return {
    ...match,
    innings: match.innings.map((inn, i): Innings => (i === current ? { ...inn, events: [...inn.events, event] } : inn)),
  };
}

export function canUndo(match: Match) {
  return match.innings.some((inn) => inn.events.length > 0);
}

export function undo(match: Match): Match {
  // An unstarted super over is undone by taking it away, which puts the match back at the tie.
  if (match.innings.length > 2 && match.innings.slice(2).every((i) => i.events.length === 0)) {
    return { ...match, innings: match.innings.slice(0, 2) };
  }
  const last = [...match.innings.keys()].reverse().find((i) => match.innings[i].events.length > 0);
  if (last === undefined) return match;
  return {
    ...match,
    innings: match.innings.map((inn, i) => (i === last ? { ...inn, events: inn.events.slice(0, -1) } : inn)),
  };
}

/** Legal balls in an innings up to and including one event. */
function legalBallsTo(match: Match, inningsIndex: number, eventIndex: number): number {
  const cut = { ...match, innings: match.innings.map((inn, i) => (i === inningsIndex ? { ...inn, events: inn.events.slice(0, eventIndex + 1) } : i > inningsIndex ? { ...inn, events: [] } : inn)) };
  return inningsState(cut, inningsIndex, null).legalBalls;
}

/** The deliveries that finished an over (not the one being bowled). */
function overEnds(match: Match, inningsIndex: number): Set<number | undefined> {
  const s = inningsState(match, inningsIndex, null);
  return new Set(s.overs.slice(0, -1).map((o) => o[o.length - 1]?.event));
}

/** The event that picked the bowler for an over, rather than one taking over partway through it. */
function startsAnOver(events: InningsEvent[], ends: Set<number | undefined>, k: number): boolean {
  for (let d = k - 1; d >= 0; d--) if (events[d].type === 'ball') return ends.has(d);
  return true;
}

/**
 * Whether a ball can stop or start counting as a ball of the over (become or stop being a wide or no-ball, or be
 * deleted): only in the over being bowled now. In a finished over it would move every over after it by a ball.
 */
export function canChangeLegality(match: Match, inningsIndex: number, eventIndex: number): boolean {
  const events = match.innings[inningsIndex]?.events ?? [];
  const laterInnings = match.innings.slice(inningsIndex + 1).some((inn) => inn.events.length > 0);
  const ends = overEnds(match, inningsIndex);
  return !laterInnings && !events.some((e, k) => k > eventIndex && e.type === 'bowler' && startsAnOver(events, ends, k));
}

/**
 * Fix or remove one delivery. Everything after it is worked out again. Whether a ball counts can only change in the
 * over being bowled; a finished over is changed as a whole with `replaceOver`.
 */
export function replaceBall(match: Match, inningsIndex: number, eventIndex: number, ball: BallEvent | null): Match {
  const old = match.innings[inningsIndex]?.events[eventIndex];
  if (!old || old.type !== 'ball') return match;
  // A wicket can be corrected (how out, who caught it) but must stay a wicket of the same batter:
  // everything after it was scored with that batter gone.
  if (Boolean(old.wicket) !== Boolean(ball?.wicket)) return match;
  if (old.wicket && ball?.wicket && old.wicket.playerOut !== ball.wicket.playerOut) return match;
  const build = (b: BallEvent | null): Match => ({
    ...match,
    innings: match.innings.map((inn, i) =>
      i !== inningsIndex
        ? inn
        : {
            ...inn,
            events: b ? inn.events.map((e, j) => (j === eventIndex ? b : e)) : inn.events.filter((_, j) => j !== eventIndex),
          },
    ),
  });
  const next = build(ball);
  // Over by over the balls must still line up with the bowlers who bowled them.
  const before = legalBallsTo(match, inningsIndex, eventIndex);
  const after = ball ? legalBallsTo(next, inningsIndex, eventIndex) : legalBallsTo(match, inningsIndex, eventIndex - 1);
  if (before !== after && !canChangeLegality(match, inningsIndex, eventIndex)) return match;
  // And every later ball must still fall inside its innings' overs and wickets. A chase that now passes its target
  // sooner keeps the balls it was scored with: the scorecard says what happened.
  return fitsTogether(next) ? next : match;
}

/** One delivery of an over being rewritten, and who bowled it. `from` is its event index if it was already there. */
export type OverBall = {
  ball: BallEvent;
  bowler: string;
  from?: number;
  /** A ball made a wicket in the editor: who came in next. Everything the batter out did after it was theirs. */
  incoming?: string;
};

/** One later event with a batter's part handed to another. */
function handOver(e: InningsEvent, from: string, to: string): InningsEvent {
  if ((e.type === 'batter' || e.type === 'retire') && e.batter === from) return { ...e, batter: to };
  if (e.type === 'ball' && e.wicket?.playerOut === from) return { ...e, wicket: { ...e.wicket, playerOut: to } };
  return e;
}

/** Who has batted (or is at the crease) in an innings at any point. */
function battedIn(events: InningsEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const e of events) {
    if (e.type === 'openers') [e.striker, e.nonStriker].forEach((id) => ids.add(id));
    if (e.type === 'batter') ids.add(e.batter);
  }
  return ids;
}

/** Who could come in after a ball made a wicket in the editor: the side's players who never batted in the innings. */
export function couldComeIn(match: Match, inningsIndex: number): string[] {
  const inn = match.innings[inningsIndex];
  const batted = battedIn(inn.events);
  return teamById(match, inn.battingTeam).players.map((p) => p.id).filter((id) => !batted.has(id));
}

/** Who was at the crease just before an event: [striker, non-striker]. */
export function creaseAt(match: Match, inningsIndex: number, eventIndex: number): [string | null, string | null] {
  const cut = { ...match, innings: match.innings.map((inn, i) => (i === inningsIndex ? { ...inn, events: inn.events.slice(0, eventIndex) } : i > inningsIndex ? { ...inn, events: [] } : inn)) };
  const s = inningsState(cut, inningsIndex, null);
  return [s.striker, s.nonStriker];
}

/** Fair deliveries in a list: the ones that take up a ball of the over. */
export const fairBalls = (rules: Rules, balls: BallEvent[]) => balls.filter((b) => isLegal(rules, b.extra)).length;

/**
 * Rewrite a bowled over: change, add or remove its deliveries and who bowled them. Every over has six fair balls, so a
 * finished over must still have six (the last over of an innings as many as it needs), and the overs after it don't
 * move. Batters coming in stay after the wicket they followed. The new match, or why it can't be done.
 */
export function replaceOver(match: Match, inningsIndex: number, overIndex: number, draft: OverBall[]): Match | string {
  const s = inningsState(match, inningsIndex, null);
  const over = s.overs[overIndex];
  if (!over?.length || !draft.length) return 'That over has no balls to change.';
  const events = match.innings[inningsIndex].events;
  const first = over[0].event!;
  const last = over[over.length - 1].event!;
  const final = overIndex === s.overs.length - 1 || s.overs.slice(overIndex + 1).every((o) => o.length === 0);
  const fair = fairBalls(match.rules, draft.map((d) => d.ball));
  if (!final && fair !== 6) return `An over has 6 fair balls: this one has ${fair}. ${fair < 6 ? `Add ${6 - fair}.` : `Take ${fair - 6} away, or make ${fair - 6 === 1 ? 'one' : 'them'} a wide or no-ball.`}`;
  if (final && fair > 6) return `An over has 6 fair balls: this one has ${fair}. Take ${fair - 6} away.`;
  // The over's own pick of bowler, just before its first ball.
  let pick = -1;
  for (let k = first - 1; k >= 0 && events[k].type !== 'ball'; k--) if (events[k].type === 'bowler') pick = k;
  // Batters coming in (and anything else) stay after the delivery they followed; bowler picks are made afresh.
  const attached = new Map<number, InningsEvent[]>();
  let owner = -1;
  for (let k = first; k <= last; k++) {
    const e = events[k];
    if (e.type === 'ball') owner = k;
    else if (e.type !== 'bowler') attached.set(owner, [...(attached.get(owner) ?? []), e]);
  }
  // A removed ball's followers go with the ball before it.
  const kept = new Set(draft.map((d) => d.from));
  const rebuilt: InningsEvent[] = [];
  // Followers of removed balls at the start of the over go after the new first ball.
  const lead: InningsEvent[] = [];
  for (let k = first; k <= last && !kept.has(k); k++) if (events[k].type === 'ball') lead.push(...(attached.get(k) ?? []));
  let on: string | null = null;
  // Balls made wickets here: where, and whose part the batter coming in takes over from then on.
  const handovers: { at: number; from: string; to?: string }[] = [];
  for (const [n, d] of draft.entries()) {
    if (d.bowler !== on) rebuilt.push({ type: 'bowler', bowler: d.bowler });
    on = d.bowler;
    const ball: BallEvent = { ...d.ball };
    delete ball.counts;
    rebuilt.push(ball);
    const was = d.from === undefined ? undefined : (events[d.from] as BallEvent);
    if (ball.wicket && !was?.wicket) {
      handovers.push({ at: rebuilt.length - 1, from: ball.wicket.playerOut, to: d.incoming });
      if (d.incoming) rebuilt.push({ type: 'batter', batter: d.incoming });
    }
    if (n === 0) rebuilt.push(...lead);
    if (d.from === undefined) continue;
    rebuilt.push(...(attached.get(d.from) ?? []));
    // Followers of removed balls straight after this one.
    for (let k = d.from + 1; k <= last && !kept.has(k); k++) if (events[k].type === 'ball') rebuilt.push(...(attached.get(k) ?? []));
  }
  const before = events.slice(0, first).filter((_, k) => k !== pick);
  let all = [...before, ...rebuilt, ...events.slice(last + 1)];
  const batted = battedIn(events);
  for (const [k, h] of handovers.entries()) {
    const at = before.length + h.at;
    if (h.to && batted.has(h.to)) return `${playerName(match, h.to)} has already batted in this innings.`;
    const [striker, nonStriker] = creaseAt({ ...match, innings: match.innings.map((x, i) => (i === inningsIndex ? { ...x, events: all } : x)) }, inningsIndex, at);
    if (h.from !== striker && h.from !== nonStriker) return `${playerName(match, h.from)} wasn’t batting on that ball.`;
    const later = all.slice(at + 1);
    if (!h.to && later.some((e) => e.type === 'ball')) return `Say who came in after ${playerName(match, h.from)} was out.`;
    if (!h.to) continue;
    all = [...all.slice(0, at + 2), ...all.slice(at + 2).map((e) => handOver(e, h.from, h.to!))];
    for (const later of handovers.slice(k + 1)) if (later.from === h.from) later.from = h.to;
  }
  const next: Match = {
    ...match,
    innings: match.innings.map((x, i) => (i === inningsIndex ? { ...x, events: all } : x)),
  };
  // The over still ends where it did: the next over's first ball is still the first ball of over overIndex + 2.
  const after = inningsState(next, inningsIndex, null);
  if (after.overs[overIndex]?.length !== draft.length) return 'A wide or no-ball can’t come after the over’s sixth fair ball. Move it earlier.';
  if (!final && after.overs.length !== s.overs.length) return 'That would move the overs after it.';
  if (!fitsTogether(next)) {
    return handovers.length
      ? 'That wicket would end the innings before the balls after it (they’d be all out).'
      : 'That doesn’t fit with the balls after it (a wicket or a batter coming in no longer lines up).';
  }
  return next;
}

/** A batter who retired in an innings: between balls (a retire event) or recorded on a delivery. */
export type Retirement = { event: number; batter: string; out: boolean; over: string };

/** Every retirement in an innings, in order, with the overs bowled when it happened. */
export function retirements(match: Match, inningsIndex: number): Retirement[] {
  const events = match.innings[inningsIndex]?.events ?? [];
  const found: Retirement[] = [];
  events.forEach((e, k) => {
    const retire = e.type === 'retire' ? { batter: e.batter, out: Boolean(e.out) } : null;
    const onBall = e.type === 'ball' && e.wicket?.kind.startsWith('retired') ? { batter: e.wicket.playerOut, out: e.wicket.kind === 'retiredout' } : null;
    const r = retire ?? onBall;
    if (r) found.push({ event: k, ...r, over: oversText(legalBallsTo(match, inningsIndex, k)) });
  });
  return found;
}

/**
 * Make a retirement hurt (not a wicket, they can come back) or out (a wicket, and they're done). Retired out can't be
 * for someone who came back to bat later. The new match, or why it can't be done.
 */
export function setRetirement(match: Match, inningsIndex: number, eventIndex: number, out: boolean): Match | string {
  const events = match.innings[inningsIndex]?.events ?? [];
  const e = events[eventIndex];
  let next: InningsEvent;
  if (e?.type === 'retire') next = out ? { ...e, out: true } : { type: 'retire', batter: e.batter };
  else if (e?.type === 'ball' && e.wicket?.kind.startsWith('retired')) next = { ...e, wicket: { ...e.wicket, kind: out ? 'retiredout' : 'retired' } };
  else return 'That isn’t a retirement.';
  const batter = e.type === 'retire' ? e.batter : e.wicket!.playerOut;
  if (out && events.some((x, k) => k > eventIndex && x.type === 'batter' && x.batter === batter)) {
    return `${playerName(match, batter)} came back to bat later, so can’t be retired out.`;
  }
  const fixed: Match = {
    ...match,
    innings: match.innings.map((inn, i) => (i === inningsIndex ? { ...inn, events: events.map((x, k) => (k === eventIndex ? next : x)) } : inn)),
  };
  return fitsTogether(fixed) ? fixed : 'That would end the innings before balls scored after it (one wicket too many).';
}

/** Every delivery in an innings came while the innings was live (a bowler on, the over and innings not over). */
function inPlayThroughout(match: Match, inningsIndex: number, target: number | null): boolean {
  const events = match.innings[inningsIndex].events;
  for (let k = 0; k < events.length; k++) {
    if (events[k].type !== 'ball') continue;
    const cut = { ...match, innings: match.innings.map((inn, i) => (i === inningsIndex ? { ...inn, events: events.slice(0, k) } : inn)) };
    if (inningsState(cut, inningsIndex, target).status !== 'live') return false;
  }
  return true;
}

/**
 * The whole match still holds together: each innings' balls inside its overs and wickets, the chase after the first
 * innings, a super over only after a tie. Targets aren't checked: a fix to the first innings doesn't undo the chase.
 */
function fitsTogether(match: Match): boolean {
  if (!inPlayThroughout(match, 0, null)) return false;
  if (match.innings[1].events.length && (inningsState(match, 0, null).status !== 'done' || !inPlayThroughout(match, 1, null))) return false;
  if (match.innings.slice(2).some((inn) => inn.events.length)) {
    if (matchState({ ...match, innings: match.innings.slice(0, 2) }).result !== 'Match tied') return false;
    if (!inPlayThroughout(match, 2, null)) return false;
    if (match.innings[3].events.length && (inningsState(match, 2, null).status !== 'done' || !inPlayThroughout(match, 3, null))) return false;
  }
  return true;
}

/**
 * Who bowled from one delivery on, up to the next change of bowler. At the first ball of an over that is the over's
 * bowler; later in an over it's a new bowler taking over (the one bowling it couldn't finish). Picking the bowler
 * who was already on takes a change away. A fix says what happened, so it may leave someone bowling two overs in a row.
 */
export function setBowlerFrom(match: Match, inningsIndex: number, eventIndex: number, bowlerId: string): Match {
  const inn = match.innings[inningsIndex];
  if (inn?.events[eventIndex]?.type !== 'ball') return match;
  if (!teamById(match, inn.bowlingTeam).players.some((p) => p.id === bowlerId)) return match;
  const events = [...inn.events];
  const ends = overEnds(match, inningsIndex);
  // The last pick of a bowler before this ball, and the ball before it.
  let pick = -1;
  for (let k = eventIndex - 1; k >= 0; k--) if (events[k].type === 'bowler') { pick = k; break; }
  let prev = -1;
  for (let k = eventIndex - 1; k >= 0; k--) if (events[k].type === 'ball') { prev = k; break; }
  const overStart = prev === -1 || ends.has(prev);
  // The over's own pick, or a change already made at this ball: change it. Otherwise someone takes over here.
  if (pick !== -1 && (overStart || pick > prev)) events[pick] = { type: 'bowler', bowler: bowlerId };
  else if (!overStart) events.splice(eventIndex, 0, { type: 'bowler', bowler: bowlerId });
  else return match;
  // A change to the bowler who was already on is no change. (A pick moves no ball between overs, but it can shift
  // the events' places, so the over ends are found again.)
  const placed = overEnds({ ...match, innings: match.innings.map((x, i) => (i === inningsIndex ? { ...x, events } : x)) }, inningsIndex);
  let on: string | null = null;
  const tidy = events.filter((e, k) => {
    if (e.type === 'bowler') {
      if (e.bowler === on && !startsAnOver(events, placed, k)) return false;
      on = e.bowler;
    }
    if (placed.has(k)) on = null;
    return true;
  });
  return { ...match, innings: match.innings.map((x, i) => (i === inningsIndex ? { ...x, events: tidy } : x)) };
}

/** Change the overs mid-match (rain, light). Never below what has already been bowled. */
export function setOvers(match: Match, overs: number, g?: number): Match {
  const state = matchState(match);
  // A super over is one over whatever the match was: changing the match's overs then would reopen its innings.
  if (state.current >= 2) return match;
  // Never below what the innings in play has already bowled; a finished first innings doesn't limit the chase.
  const bowled = Math.max(Math.ceil(state.innings[Math.min(state.current, 1)].legalBalls / 6), 1);
  const after = Math.max(overs, bowled);
  if (after === match.rules.overs) return match;
  // Note where the innings stood, so DLS can work out what was lost (super overs don't take part).
  const index = state.current >= 2 ? null : (state.current as 0 | 1);
  const s = index === null ? null : state.innings[index];
  const cut = s ? { innings: index!, balls: s.legalBalls, wickets: s.wickets, before: match.rules.overs, after } : null;
  return {
    ...match,
    originalOvers: match.originalOvers ?? match.rules.overs,
    interruptions: cut ? [...(match.interruptions ?? []), cut] : match.interruptions,
    dlsG: match.dlsG ?? g,
    // A target agreed by hand was for the old length: DLS sets the new one (it can be agreed again after).
    revisedTarget: undefined,
    rules: { ...match.rules, overs: after },
  };
}

/** One line for what an event was, e.g. for "Undid: FOUR by Rohit". */
export function describeEvent(match: Match, e: InningsEvent, striker: string | null): string {
  switch (e.type) {
    case 'openers':
      return 'opening batters';
    case 'bowler':
      return `${playerName(match, e.bowler)} to bowl`;
    case 'batter':
      return `${playerName(match, e.batter)} coming in`;
    case 'swap':
      return 'strike swap';
    case 'retire':
      return `${playerName(match, e.batter)} retiring${e.out ? ' out' : ''}`;
    case 'endInnings':
      return 'end of innings';
    case 'penalty':
      return `${e.runs} penalty runs`;
    case 'deadBall':
      return 'dead ball';
  }
  if (e.wicket && e.wicket.kind !== 'retired') return `wicket of ${playerName(match, e.wicket.playerOut)}`;
  const runs = `${e.runs} run${e.runs === 1 ? '' : 's'}`;
  if (e.bouncer) return e.runs ? `bouncer + ${runs}` : 'bouncer';
  if (e.extra === 'wide') return e.runs ? `wide + ${runs}` : 'wide';
  if (e.extra === 'noball') return e.runs ? `no ball + ${runs}` : 'no ball';
  if (e.extra === 'bye') return `${runs} bye${e.runs === 1 ? '' : 's'}`;
  if (e.extra === 'legbye') return `${runs} leg bye${e.runs === 1 ? '' : 's'}`;
  const who = playerName(match, striker);
  if (e.runs === 4) return `FOUR by ${who}`;
  if (e.runs === 6) return `SIX by ${who}`;
  return e.runs ? `${runs} to ${who}` : 'dot ball';
}

export type Highlight =
  | { kind: 'fifty' | 'hundred'; player: string; runs: number }
  | { kind: 'hattrick'; player: string }
  | { kind: 'maiden'; player: string };

/** Milestones reached between two states of the same innings: the moments worth a celebration. */
export function highlights(before: InningsState, after: InningsState): Highlight[] {
  const out: Highlight[] = [];
  for (const b of after.batters) {
    const was = before.batters.find((x) => x.id === b.id)?.runs ?? 0;
    if (was < 100 && b.runs >= 100) out.push({ kind: 'hundred', player: b.id, runs: b.runs });
    else if (was < 50 && b.runs >= 50) out.push({ kind: 'fifty', player: b.id, runs: b.runs });
  }
  for (const [id, n] of Object.entries(after.streaks)) {
    if (n >= 3 && (before.streaks[id] ?? 0) < 3) out.push({ kind: 'hattrick', player: id });
  }
  for (const b of after.bowlers) {
    const was = before.bowlers.find((x) => x.id === b.id)?.maidens ?? 0;
    if (b.maidens > was) out.push({ kind: 'maiden', player: b.id });
  }
  return out;
}

/** Overs a bowler has left under the per-bowler limit, or null when there is no limit. */
export function oversLeft(match: Match, s: InningsState, bowlerId: string): number | null {
  const limit = match.rules.maxOversPerBowler;
  if (!limit) return null;
  const oversOf = (id: string) => Math.ceil((s.bowlers.find((b) => b.id === id)?.balls ?? 0) / 6);
  const bowled = oversOf(bowlerId);
  // A bowler past the limit has used one of the extra-over places; others can take one while places are left.
  const extended = s.bowlers.filter((b) => b.id !== bowlerId && oversOf(b.id) > limit).length;
  const mayExtend = bowled > limit || extended < (match.rules.extraOverBowlers ?? 0);
  return Math.max(0, (mayExtend ? limit + 1 : limit) - bowled);
}
