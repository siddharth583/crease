import { addEvent, matchState, newMatch, oversLeft, type InningsState } from '../engine/engine.ts';
import type { BallEvent, InningsEvent, Match, Rules, Team, WicketKind } from '../engine/types.ts';

// A believable sample season for trying the app: Copan A vs Copan B, 10 overs, 8 a side, six Sundays.
// Every match is played ball by ball through the real engine, so all the stats behave exactly as scored ones.

/** 0 to 1 for batting, bowling and fielding; `keeps` is who keeps wicket for the side (backup on the odd day). */
type Profile = { name: string; bat: number; bowl: number; field: number; keeps?: 'main' | 'backup' };

const COPAN_A: Profile[] = [
  { name: 'Siddharth Singh', bat: 0.95, bowl: 0.93, field: 0.97 }, // best batsman and bowler, gun fielder
  { name: 'Rishav Bhattacharjee', bat: 0.58, bowl: 0.58, field: 0.5 }, // all-rounder
  { name: 'Anshul Rana', bat: 0.82, bowl: 0.8, field: 0.75 }, // second best batsman and bowler, good fielder
  { name: 'Nitin Parmar', bat: 0.66, bowl: 0.15, field: 0.75, keeps: 'main' }, // batsman, good fielder, keeps
  { name: 'Harleen Singh', bat: 0.45, bowl: 0.72, field: 0.75 }, // third best bowler, good fielder
  { name: 'Satnoor Singh', bat: 0.28, bowl: 0.15, field: 0.35 }, // not that good
  { name: 'Moses Wiliams', bat: 0.26, bowl: 0.1, field: 0.3 }, // not that good
  { name: 'Supreet Guleria', bat: 0.26, bowl: 0.1, field: 0.3 }, // not that good
];

const COPAN_B: Profile[] = [
  // Best batsman and bowler, and a gun keeper. He keeps nearly every game, so he rarely gets a bowl.
  { name: 'Nihal Walia', bat: 0.95, bowl: 0.93, field: 0.97, keeps: 'main' },
  { name: 'Ashwani Singh', bat: 0.82, bowl: 0.8, field: 0.75 }, // second best batsman and bowler, good fielder
  { name: 'Karandeep Singh', bat: 0.25, bowl: 0.72, field: 0.45 }, // bowler, third best
  { name: 'Navjot Singh', bat: 0.66, bowl: 0.12, field: 0.5, keeps: 'backup' }, // batsman, keeps when Nihal fields
  { name: 'Chirag', bat: 0.52, bowl: 0.5, field: 0.5 }, // all-rounder, medium good
  { name: 'Charanjeet', bat: 0.32, bowl: 0.32, field: 0.35 }, // all-rounder, not that good
  { name: 'Rajeev', bat: 0.26, bowl: 0.12, field: 0.3 }, // not that good
  { name: 'Rohit', bat: 0.18, bowl: 0.56, field: 0.4 }, // bowler
];

export const SAMPLE_RULES: Rules = {
  overs: 10,
  playersPerSide: 8,
  extraRun: 1,
  reball: true,
  lastManStands: false,
  maxOversPerBowler: 2,
  extraOverBowlers: 2, // two bowl 3 overs, the rest 2
  freeHit: true,
  bouncer: { fair: 1, calledAs: 'noball' },
};

/** Picked from a search for a season that looks like these two squads: stars on top, close games, both sides winning. */
export const SEED = 10994;

/** Small seeded generator (mulberry32), so the sample season is the same every time. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(rng: () => number, items: [T, number][]): T {
  const total = items.reduce((n, [, w]) => n + Math.max(0, w), 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    r -= Math.max(0, w);
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}

function makeTeam(id: string, name: string, profiles: Profile[]): Team {
  return { id, name, players: profiles.map((p, i) => ({ id: `${id}-p${i + 1}`, name: p.name })) };
}

type Side = { team: Team; profiles: Map<string, Profile>; keeper: string | null };

function side(team: Team, profiles: Profile[]): Side {
  return { team, profiles: new Map(team.players.map((p, i) => [p.id, profiles[i]])), keeper: null };
}

/** The main keeper keeps most days; on the odd day the backup keeps and the main keeper fields (and can bowl). */
function withKeeper(rng: () => number, s: Side): Side {
  const find = (k: 'main' | 'backup') => [...s.profiles].find(([, p]) => p.keeps === k)?.[0] ?? null;
  const main = find('main');
  const backup = find('backup');
  return { ...s, keeper: backup && rng() < 0.2 ? backup : main };
}

/** Batting order: the best bats first, with a little shuffling in the middle from week to week. */
function battingOrder(rng: () => number, s: Side): string[] {
  return [...s.team.players]
    .map((p) => ({ id: p.id, key: s.profiles.get(p.id)!.bat + (rng() - 0.5) * 0.18 }))
    .sort((a, b) => b.key - a.key)
    .map((p) => p.id);
}

function chooseBowler(rng: () => number, match: Match, s: InningsState, bowling: Side): string {
  const overNo = Math.floor(s.legalBalls / 6);
  const candidates = bowling.team.players
    .map((p) => p.id)
    .filter((id) => id !== s.lastOverBowler && id !== bowling.keeper && oversLeft(match, s, id) !== 0);
  // Captains lean hard on their best bowlers (they get the 3-over spells), especially up front and at the death.
  const death = overNo >= 7 || overNo <= 1;
  return pickWeighted(
    rng,
    candidates.map((id) => {
      const skill = bowling.profiles.get(id)!.bowl;
      return [id, Math.pow(skill + 0.05, death ? 8 : 5)] as [string, number];
    }),
  );
}

function delivery(
  rng: () => number,
  match: Match,
  s: InningsState,
  batting: Side,
  bowling: Side,
): BallEvent {
  const bat = batting.profiles.get(s.striker!)!;
  const bowl = bowling.profiles.get(s.bowler!)!;
  const overNo = Math.floor(s.legalBalls / 6);
  const chasing = s.target !== null;
  const needRate = chasing ? ((s.target! - s.runs) * 6) / Math.max(1, s.maxBalls - s.legalBalls) : 0;
  // Batters swing harder at the death and when the asking rate climbs.
  const intent = (overNo >= 7 ? 0.12 : 0) + (chasing && needRate > 9 ? 0.1 : 0);
  const edge = bat.bat - bowl.bowl * 0.65 + intent;

  const r = rng();
  const wide = 0.025 + (1 - bowl.bowl) * 0.05;
  const noball = 0.008 + (1 - bowl.bowl) * 0.01;
  if (r < wide) return { type: 'ball', runs: rng() < 0.08 ? 1 : 0, extra: 'wide' };
  if (r < wide + noball) return { type: 'ball', runs: pickWeighted(rng, [[0, 4], [1, 3], [4, 1], [6, 0.5]]), extra: 'noball' };

  const fielding = (id: string) => bowling.profiles.get(id)!.field;
  const outfield = bowling.team.players.map((p) => p.id).filter((id) => id !== bowling.keeper && id !== s.bowler);
  // Better fielders are where the ball goes (they're put there) and sharper to a chance.
  const pickFielder = () => pickWeighted(rng, outfield.map((id) => [id, 0.25 + fielding(id) * 1.5] as [string, number]));
  const chance = s.freeHit ? 0.008 : 0.02 + bowl.bowl * bowl.bowl * 0.085 + (1 - bat.bat) * 0.06 + intent * 0.12;
  if (rng() < chance) {
    const kind: WicketKind = s.freeHit
      ? 'runout'
      : pickWeighted(rng, [
          ['caught', 50],
          ['bowled', 24],
          ['lbw', 8],
          ['runout', 10],
          // A sharp keeper turns half-chances down the leg side into stumpings.
          ['stumped', bowling.keeper ? 4 + fielding(bowling.keeper) * 14 : 0],
          ['hitwicket', 1],
        ]);
    let fielder: string | undefined;
    if (kind === 'caught') {
      const where = rng();
      fielder = bowling.keeper && where < 0.28 ? bowling.keeper : where < 0.36 ? s.bowler! : pickFielder();
    } else if (kind === 'stumped') fielder = bowling.keeper!;
    else if (kind === 'runout') fielder = rng() < 0.2 && bowling.keeper ? bowling.keeper : pickFielder();
    // A chance only becomes a wicket if it's taken: the sharper the fielder, the fewer go down.
    if (fielder && rng() > 0.45 + fielding(fielder) * 0.55) return { type: 'ball', runs: rng() < 0.5 ? 1 : 0 };
    const playerOut = kind === 'runout' && s.nonStriker && rng() < 0.35 ? s.nonStriker : s.striker!;
    return { type: 'ball', runs: kind === 'runout' ? (rng() < 0.6 ? 1 : 0) : 0, wicket: { kind, playerOut, fielder } };
  }

  if (rng() < 0.025) return { type: 'ball', runs: 1, extra: rng() < 0.6 ? 'legbye' : 'bye' };

  return {
    type: 'ball',
    runs: pickWeighted(rng, [
      [0, 0.34 - edge * 0.22],
      [1, 0.33],
      [2, 0.1 + edge * 0.04],
      [3, 0.015],
      [4, 0.11 + edge * 0.16],
      [6, 0.035 + edge * 0.13],
    ]),
  };
}

function playInnings(rng: () => number, match: Match, index: number, batting: Side, bowling: Side): Match {
  const order = battingOrder(rng, batting);
  let m = addEvent(match, { type: 'openers', striker: order[0], nonStriker: order[1] });
  let next = 2;
  for (let guard = 0; guard < 400; guard++) {
    const st = matchState(m);
    if (st.result || st.current !== index) return m;
    const s = st.innings[index];
    let e: InningsEvent;
    if (s.status === 'batter') {
      const fresh = order.slice(next).find((id) => s.available.includes(id)) ?? s.available[0];
      next = Math.max(next, order.indexOf(fresh) + 1);
      e = { type: 'batter', batter: fresh };
    } else if (s.status === 'bowler') e = { type: 'bowler', bowler: chooseBowler(rng, m, s, bowling) };
    else if (s.status === 'live') e = delivery(rng, m, s, batting, bowling);
    else return m;
    m = addEvent(m, e);
  }
  return m;
}

/** The Copan Cup: a best-of-seven between Copan A and Copan B, six Sundays played, newest last week. */
export function sampleSeason(now = new Date(), seed = SEED): { matches: Match[]; teams: Team[] } {
  const rng = seeded(seed);
  const a = makeTeam('copan-a', 'Copan A', COPAN_A);
  const b = makeTeam('copan-b', 'Copan B', COPAN_B);
  const sides = { [a.id]: side(a, COPAN_A), [b.id]: side(b, COPAN_B) };

  const lastSunday = new Date(now);
  lastSunday.setHours(9, 30, 0, 0);
  lastSunday.setDate(lastSunday.getDate() - ((lastSunday.getDay() + 7) % 7 || 7));

  const matches: Match[] = [];
  for (let week = 5; week >= 0; week--) {
    const tossWinner = rng() < 0.5 ? a : b;
    let m = newMatch(`copan-cup-${6 - week}`, [a, b], SAMPLE_RULES, {
      winner: tossWinner.id,
      choice: rng() < 0.55 ? 'bowl' : 'bat',
    });
    m.createdAt = lastSunday.getTime() - week * 7 * 86_400_000;
    m.series = { id: 'copan-cup-2026', name: 'Copan Cup', of: 7, number: 6 - week };
    const today = { [a.id]: withKeeper(rng, sides[a.id]), [b.id]: withKeeper(rng, sides[b.id]) };
    m.keepers = { [a.id]: today[a.id].keeper!, [b.id]: today[b.id].keeper! };
    m.captains = { [a.id]: a.players[0].id, [b.id]: b.players[0].id }; // Siddharth and Nihal lead
    for (const i of [0, 1]) {
      const inn = m.innings[i];
      m = playInnings(rng, m, i, today[inn.battingTeam], today[inn.bowlingTeam]);
    }
    matches.push(m);
  }
  return { matches, teams: [a, b] };
}
