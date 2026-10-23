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
};

export type BallTone = 'dot' | 'run' | 'four' | 'six' | 'wicket' | 'extra';
/** `event` is the delivery's index in its innings' events, so the ball can be edited later. */
export type BallView = { label: string; tone: BallTone; event?: number; wicket?: boolean };

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
  batters: BatterLine[];
  bowlers: BowlerLine[];
  fallOfWickets: { wicket: number; runs: number; over: string; player: string }[];
  overs: BallView[][];
  /** Runs and wickets in each over, in step with `overs`. */
  overTotals: { runs: number; wickets: number }[];
  partnership: { runs: number; balls: number };
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
    maxBalls: index >= 2 ? 6 : rules.overs * 6,
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0, penalty: 0 },
    striker: null,
    nonStriker: null,
    bowler: null,
    lastOverBowler: null,
    batters: [],
    bowlers: [],
    fallOfWickets: [],
    overs: [[]],
    overTotals: [{ runs: 0, wickets: 0 }],
    partnership: { runs: 0, balls: 0 },
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
    if (!line) s.bowlers.push((line = { id, balls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noballs: 0 }));
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
      batter(e.batter).retired = true;
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

    // A delivery. A bouncer is a fair ball until the over's allowance is used; after that it's called.
    let calledBouncer = false;
    if (e.bouncer) {
      if (bouncersThisOver >= (rules.bouncer?.fair ?? 0)) {
        e = { ...e, extra: rules.bouncer?.calledAs ?? 'wide' };
        calledBouncer = true;
      }
      bouncersThisOver += 1;
    }
    const legal = isLegal(rules, e.extra);
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
    }

    const view = calledBouncer && !e.wicket ? { label: `Bn${e.runs ? `+${e.runs}` : ''}`, tone: 'extra' as const } : ballView(rules, e);
    s.overs[s.overs.length - 1].push({ ...view, event: eventIndex, wicket: Boolean(e.wicket) });
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
      if (s.striker === out.id) s.striker = null;
      if (s.nonStriker === out.id) s.nonStriker = null;
      s.partnership = { runs: 0, balls: 0 };
    }

    const bowlersWicket = e.wicket && BOWLER_WICKETS.includes(e.wicket.kind);
    if (bowlerId && legal && !bowlersWicket) s.streaks[bowlerId] = 0;

    if (legal) {
      s.legalBalls += 1;
      if (s.legalBalls % 6 === 0) {
        if (bowlerId && overConceded === 0) bowler(bowlerId).maidens += 1;
        overConceded = 0;
        swap();
        s.lastOverBowler = bowlerId;
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
  if (s.status === 'done') s.freeHit = false;
  if (s.overs.length > 1 && s.overs[s.overs.length - 1].length === 0 && s.status === 'done') {
    s.overs.pop();
    s.overTotals.pop();
  }
  return s;
}

/** The chase target: the first innings plus one, unless one was agreed after lost overs. */
export const chaseTarget = (match: Match, firstRuns: number) => match.revisedTarget ?? firstRuns + 1;

export function matchState(match: Match): MatchState {
  const first = inningsState(match, 0, null);
  const target = chaseTarget(match, first.runs);
  const second = inningsState(match, 1, target);
  const innings = [first, second];
  let current = first.status === 'done' ? 1 : 0;

  let result: string | null = null;
  let winner: string | null = null;
  if (first.status === 'done' && second.status === 'done') {
    if (second.runs >= target) {
      const left = allOutAt(match.rules, second.battingTeam) - second.wickets;
      winner = second.battingTeam.id;
      result = `${second.battingTeam.name} won by ${left} wicket${left === 1 ? '' : 's'}`;
    } else if (second.runs === target - 1) {
      result = 'Match tied';
    } else {
      const margin = target - 1 - second.runs;
      winner = first.battingTeam.id;
      result = `${first.battingTeam.name} won by ${margin} run${margin === 1 ? '' : 's'}`;
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

/** A fair chase target after overs are lost: the first innings scaled to the overs the chase gets, plus one. */
export function parTarget(firstRuns: number, originalOvers: number, chaseOvers: number): number {
  return Math.floor((firstRuns * chaseOvers) / originalOvers) + 1;
}

/** Add a late arrival (or substitute) to a side mid-match. */
export function addPlayer(match: Match, teamId: string, player: { id: string; name: string }): Match {
  return {
    ...match,
    teams: match.teams.map((t) => (t.id === teamId ? { ...t, players: [...t.players, player] } : t)) as [Team, Team],
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
  if (line.retired) return 'retired';
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
    default:
      return 'retired';
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

/** Fix or remove one delivery that has no wicket. Everything after it is worked out again. */
export function replaceBall(match: Match, inningsIndex: number, eventIndex: number, ball: BallEvent | null): Match {
  const old = match.innings[inningsIndex]?.events[eventIndex];
  if (!old || old.type !== 'ball') return match;
  // A wicket can be corrected (how out, who caught it) but must stay a wicket of the same batter:
  // everything after it was scored with that batter gone.
  if (Boolean(old.wicket) !== Boolean(ball?.wicket)) return match;
  if (old.wicket && ball?.wicket && old.wicket.playerOut !== ball.wicket.playerOut) return match;
  return {
    ...match,
    innings: match.innings.map((inn, i) =>
      i !== inningsIndex
        ? inn
        : {
            ...inn,
            events: ball
              ? inn.events.map((e, j) => (j === eventIndex ? ball : e))
              : inn.events.filter((_, j) => j !== eventIndex),
          },
    ),
  };
}

/** Change the overs mid-match (rain, light). Never below what has already been bowled. */
export function setOvers(match: Match, overs: number): Match {
  const bowled = Math.max(...matchState(match).innings.map((s) => Math.ceil(s.legalBalls / 6)), 1);
  return { ...match, originalOvers: match.originalOvers ?? match.rules.overs, rules: { ...match.rules, overs: Math.max(overs, bowled) } };
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
      return `${playerName(match, e.batter)} retiring`;
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
