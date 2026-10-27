import { matchState } from './engine.ts';
import type { Rating, SquadPlayer } from './squad.ts';
import { displayName, isPlaceholder, keyFor, playerKey } from './stats.ts';
import type { Match } from './types.ts';

// Each player's rating, match by match, worked out from what they did: a score out of 10 for every match, and from
// all of them, batting, bowling and fielding stars ranked against the rest of the squad.

/** One player's game: points for each suit and the rating out of 10 they make. */
export type MatchRating = {
  matchId: string;
  date: number;
  opponent: string;
  rating: number;
  bat: number | null;
  bowl: number | null;
  field: number;
};

export type PlayerRatings = {
  key: string;
  name: string;
  /** Matches with a rating (they batted, bowled or took a catch). */
  matches: number;
  /** Their last five ratings, averaged: how they're going now. */
  form: number | null;
  /** Newest first. */
  history: MatchRating[];
  /** From all their matches, against the squad: null until there are enough to say. */
  stars: { bat: Rating; bowl: Rating; field: Rating } | null;
};

/** Matches before the stars are worked out from them rather than set by hand. */
export const MATCHES_TO_RATE = 2;
const FORM_OF = 5;

/** Points to a rating out of 10: an ordinary game is 6, a match-winning one 9 or more. */
const toRating = (points: number) => Math.round(Math.min(10, Math.max(1, 6 + points / 8)) * 10) / 10;

/**
 * What everyone did in one finished match, in points. Batting: a run each, and up to a few more (or fewer) for scoring
 * faster (or slower) than a run a ball; a duck costs 4. Bowling: 20 a wicket, 5 a maiden, and the runs saved (or given
 * away) against how fast the match was scored. Fielding: 8 a catch, run out or stumping.
 */
export function matchRatings(match: Match): Map<string, MatchRating> {
  const out = new Map<string, MatchRating>();
  const state = matchState(match);
  if (!state.result) return out;
  const keyOf = new Map<string, string>();
  for (const team of match.teams) for (const p of team.players) if (!isPlaceholder(p.name)) keyOf.set(p.id, keyFor(team, p));
  const main = state.innings.slice(0, 2);
  const balls = main.reduce((n, inn) => n + inn.legalBalls, 0);
  const perBall = balls ? main.reduce((n, inn) => n + inn.runs, 0) / balls : 0;
  const line = (id: string | null | undefined, opponent: string) => {
    const key = id ? keyOf.get(id) : undefined;
    if (!key) return null;
    let l = out.get(key);
    if (!l) out.set(key, (l = { matchId: match.id, date: match.createdAt, opponent, rating: 0, bat: null, bowl: null, field: 0 }));
    return l;
  };
  for (const inn of main) {
    for (const b of inn.batters) {
      const l = line(b.id, inn.bowlingTeam.name);
      if (!l || (b.retired && !b.balls)) continue;
      const pace = b.balls >= 6 ? Math.max(-5, Math.min(8, ((b.runs * 100) / b.balls - 100) / 20)) : 0;
      l.bat = b.runs + pace - (b.out && b.runs === 0 ? 4 : 0);
      if (b.out?.fielder && (b.out.kind === 'caught' || b.out.kind === 'runout' || b.out.kind === 'stumped')) {
        const f = line(b.out.fielder, inn.battingTeam.name);
        if (f) f.field += 8;
      }
    }
    for (const bw of inn.bowlers) {
      if (!bw.balls && !bw.runs) continue;
      const l = line(bw.id, inn.battingTeam.name);
      if (!l) continue;
      l.bowl = bw.wickets * 20 + bw.maidens * 5 + (perBall * bw.balls - bw.runs);
    }
  }
  for (const l of out.values()) l.rating = toRating((l.bat ?? 0) + (l.bowl ?? 0) + l.field);
  return out;
}

/** One player's ratings, newest first, and their form from the last five: anyone who has played, in the squad or not. */
export function playerRatings(matches: Match[], key: string): { history: MatchRating[]; form: number | null } {
  const history = [...matches]
    .sort((a, b) => b.createdAt - a.createdAt)
    .flatMap((m) => matchRatings(m).get(key) ?? []);
  const recent = history.slice(0, FORM_OF);
  return { history, form: recent.length ? Math.round((recent.reduce((n, r) => n + r.rating, 0) / recent.length) * 10) / 10 : null };
}

/** 1 to 5 stars by where a figure ranks among everyone who has one (the best get 5). */
function ranked(values: Map<string, number>): Map<string, Rating> {
  const sorted = [...values.entries()].sort((a, b) => a[1] - b[1]);
  const stars = new Map<string, Rating>();
  sorted.forEach(([key], i) => stars.set(key, (sorted.length === 1 ? 3 : 1 + Math.round((4 * i) / (sorted.length - 1))) as Rating));
  return stars;
}

/**
 * Every squad player's ratings from these matches. Stars come once a player has `MATCHES_TO_RATE` rated matches:
 * batting from points an innings, bowling from points a match bowled, fielding from points a match, each ranked
 * against the squad. A player who never bowls gets one bowling star.
 */
export function squadRatings(matches: Match[], squad: SquadPlayer[]): Map<string, PlayerRatings> {
  const keyOf = (p: SquadPlayer) => playerKey({ id: '', name: '', players: [] }, p.name);
  const lines = new Map<string, MatchRating[]>();
  for (const m of [...matches].sort((a, b) => b.createdAt - a.createdAt))
    for (const [key, r] of matchRatings(m)) lines.set(key, [...(lines.get(key) ?? []), r]);

  const bat = new Map<string, number>();
  const bowl = new Map<string, number>();
  const field = new Map<string, number>();
  for (const p of squad) {
    const key = keyOf(p);
    const h = lines.get(key) ?? [];
    if (h.length < MATCHES_TO_RATE) continue;
    const batted = h.filter((r) => r.bat !== null);
    const bowled = h.filter((r) => r.bowl !== null);
    if (batted.length) bat.set(key, batted.reduce((n, r) => n + r.bat!, 0) / batted.length);
    if (bowled.length) bowl.set(key, bowled.reduce((n, r) => n + r.bowl!, 0) / bowled.length);
    field.set(key, h.reduce((n, r) => n + r.field, 0) / h.length);
  }
  const batStars = ranked(bat);
  const bowlStars = ranked(bowl);
  const fieldStars = ranked(field);

  const out = new Map<string, PlayerRatings>();
  for (const p of squad) {
    const key = keyOf(p);
    const history = lines.get(key) ?? [];
    const recent = history.slice(0, FORM_OF);
    const rated = history.length >= MATCHES_TO_RATE;
    out.set(p.id, {
      key,
      name: displayName(p.name),
      matches: history.length,
      form: recent.length ? Math.round((recent.reduce((n, r) => n + r.rating, 0) / recent.length) * 10) / 10 : null,
      history,
      stars: rated ? { bat: batStars.get(key) ?? 1, bowl: bowlStars.get(key) ?? 1, field: fieldStars.get(key) ?? 1 } : null,
    });
  }
  return out;
}

/**
 * The squad with the stars it plays to: worked out from matches once a player has enough of them, unless they're set
 * by hand. This is what the auction and the squad list use.
 */
export function ratedSquad(matches: Match[], squad: SquadPlayer[]): SquadPlayer[] {
  const ratings = squadRatings(matches, squad);
  return squad.map((p) => {
    const stars = ratings.get(p.id)?.stars;
    return stars && !p.manual ? { ...p, ...stars } : p;
  });
}

