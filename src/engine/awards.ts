import { matchRatings } from './ratings.ts';
import { records } from './records.ts';
import { careerStats } from './stats.ts';
import type { Match } from './types.ts';

// The season's awards, from the matches given (a year's, or all of them): the caps and the trophies a league hands out,
// worked out from the same numbers as the record book and the match ratings.

export type AwardWinner = { name: string; key: string; team: string; /** The figure, e.g. "147" or "7.4". */ value: string; sub: string };
export type Award = {
  id: string;
  title: string;
  /** What it's for, in a few words. */
  blurb: string;
  icon: string;
  /** Best first: the winner, then the ones chasing. */
  winners: AwardWinner[];
};

/** Matches a player needs for the rating awards: one good day isn't a season. */
export const MATCHES_FOR_MVP = 3;
export const MATCHES_FOR_IMPROVED = 4;
/** How many of their latest matches Most Improved looks at, against the ones before. */
const RECENT = 3;

const mean = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / xs.length;

export function seasonAwards(matches: Match[]): Award[] {
  const r = records(matches);
  const careers = careerStats(matches);
  const byKey = new Map(careers.map((c) => [c.key, c]));

  // Each player's match ratings, oldest first.
  const ratings = new Map<string, { date: number; rating: number }[]>();
  for (const m of matches)
    for (const [key, x] of matchRatings(m)) ratings.set(key, [...(ratings.get(key) ?? []), { date: m.createdAt, rating: x.rating }]);
  for (const list of ratings.values()) list.sort((a, b) => a.date - b.date);
  const who = (key: string) => byKey.get(key);

  const mvp: AwardWinner[] = [...ratings.entries()]
    .filter(([key, list]) => who(key) && list.length >= MATCHES_FOR_MVP)
    .map(([key, list]) => ({ c: who(key)!, avg: mean(list.map((x) => x.rating)), n: list.length }))
    .sort((a, b) => b.avg - a.avg || b.n - a.n)
    .slice(0, 3)
    .map(({ c, avg, n }) => ({ name: c.name, key: c.key, team: c.team, value: avg.toFixed(1), sub: `average rating over ${n} matches` }));

  const improved: AwardWinner[] = [...ratings.entries()]
    .filter(([key, list]) => who(key) && list.length >= MATCHES_FOR_IMPROVED)
    .map(([key, list]) => {
      const recent = list.slice(-RECENT).map((x) => x.rating);
      const before = list.slice(0, -RECENT).map((x) => x.rating);
      return { c: who(key)!, gain: mean(recent) - mean(before), recent: mean(recent), before: mean(before) };
    })
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3)
    .map(({ c, gain, recent, before }) => ({ name: c.name, key: c.key, team: c.team, value: `+${gain.toFixed(1)}`, sub: `${before.toFixed(1)} before, ${recent.toFixed(1)} in the last ${RECENT}` }));

  const count = (list: { name: string; key: string; team: string; count: number; sub?: string }[], unit: string): AwardWinner[] =>
    list.slice(0, 3).map((x) => ({ name: x.name, key: x.key, team: x.team, value: String(x.count), sub: x.sub ? `${x.sub}` : unit }));
  const rate = (list: { name: string; key: string; team: string; rate: number; sub: string }[], digits: number): AwardWinner[] =>
    list.slice(0, 3).map((x) => ({ name: x.name, key: x.key, team: x.team, value: x.rate.toFixed(digits), sub: x.sub }));

  const awards: Award[] = [
    { id: 'mvp', title: 'Player of the Season', blurb: `Best average match rating, ${MATCHES_FOR_MVP}+ matches`, icon: 'star', winners: mvp },
    { id: 'orange', title: 'Orange Cap', blurb: 'Most runs', icon: 'trending-up', winners: count(r.mostRuns, 'runs') },
    { id: 'purple', title: 'Purple Cap', blurb: 'Most wickets', icon: 'disc', winners: count(r.mostWickets, 'wickets') },
    { id: 'sixer', title: 'Sixer King', blurb: 'Most sixes', icon: 'baseball', winners: count(r.mostSixes, 'sixes') },
    { id: 'striker', title: 'Fastest Hands', blurb: 'Best strike rate, 30+ balls', icon: 'flash', winners: rate(r.bestStrikeRate, 0) },
    { id: 'miser', title: 'The Miser', blurb: 'Best economy, 6+ overs', icon: 'shield-checkmark', winners: rate(r.bestEconomy, 2) },
    { id: 'hands', title: 'Safe Hands', blurb: 'Catches, run-outs and stumpings', icon: 'hand-left', winners: count(r.mostDismissals, 'dismissals') },
    { id: 'mom', title: 'Man of the Match', blurb: 'Most match awards', icon: 'ribbon', winners: r.mostMoM.slice(0, 3).map((x) => ({ name: x.name, key: x.key, team: x.team, value: `${x.count}×`, sub: x.team })) },
    { id: 'improved', title: 'Most Improved', blurb: `Last ${RECENT} matches against the ones before, ${MATCHES_FOR_IMPROVED}+ matches`, icon: 'rocket', winners: improved },
  ];
  return awards.filter((a) => a.winners.length > 0);
}
