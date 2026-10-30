/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSeason } from '../demo/sampleSeason.ts';
import { matchState } from './engine.ts';
import { careerStats } from './stats.ts';
import { BALLS_TO_CALL, headToHead, matchups, records, rivalry, rivalryContext, verdict } from './records.ts';

const { matches } = sampleSeason(new Date('2026-10-23T12:00:00Z'));

test('the record book from the sample season', () => {
  const r = records(matches);
  assert.equal(r.highScores.length, 5);
  assert.ok(r.highScores[0].runs >= r.highScores[1].runs);
  assert.ok(r.bestBowling[0].wickets >= r.bestBowling[4].wickets);
  assert.ok(r.partnerships[0].runs > 0 && r.partnerships[0].names.includes('&'));
  assert.ok(r.highestTotals[0].runs >= r.lowestTotals[0].runs);
  assert.equal(r.mostMoM.reduce((n, x) => n + x.count, 0), 6, 'one Man of the Match per finished game');
});

test('the bowlers’ records: boundaries conceded, dots, wides and no-balls, the dearest spells', () => {
  const r = records(matches);
  const careers = careerStats(matches);
  const fours = careers.reduce((n, c) => n + c.bowling.fours, 0);
  // Every four hit was off someone: the leader can't have conceded more than were hit.
  assert.ok(r.mostFoursConceded[0].count > 0 && r.mostFoursConceded[0].count <= fours);
  assert.equal(fours, careers.reduce((n, c) => n + c.batting.fours, 0));
  assert.ok(r.mostSixesConceded.every((x, i, xs) => i === 0 || xs[i - 1].count >= x.count));
  for (const x of r.mostDots) {
    const balls = careers.find((c) => c.key === x.key)!.bowling.balls;
    assert.ok(x.count <= balls, `${x.name}: no more dots than balls`);
  }
  const extras = matchState(matches[0]).innings.flatMap((s) => s.bowlers).reduce((n, b) => n + b.wides + b.noballs, 0);
  assert.ok(extras === 0 || r.mostExtras.length > 0);
  assert.equal(r.dearestSpells.length, 3);
  assert.ok(r.dearestSpells[0].runs >= r.dearestSpells[2].runs);
  for (const x of r.bestAverage) assert.ok(x.rate > 0 && /out \d+ time/.test(x.sub));
});

test('head to head adds up', () => {
  const h = headToHead(matches, 'Copan Strikers', 'copan royals');
  assert.equal(h.played, 6);
  assert.equal(h.winsA + h.winsB + h.ties, 6);
  assert.equal(h.recent.length, 5);
});

test('batter against bowler counts the balls each faced from each', () => {
  const all = matchups(matches);
  const faced = all.reduce((n, p) => n + p.balls, 0);
  const expected = matches
    .flatMap((m) => matchState(m).innings.slice(0, 2))
    .reduce((n, s) => n + s.log.filter((d) => d.ball.extra !== 'wide').length, 0);
  assert.equal(faced, expected);
});

test('partnerships add up to the runs off the bat and extras', () => {
  for (const m of matches) {
    for (const s of matchState(m).innings.slice(0, 2)) {
      const sum = s.partnerships.reduce((n, p) => n + p.runs, 0);
      assert.equal(sum, s.runs - s.extras.penalty, `${m.id}`);
    }
  }
});

test('a rivalry adds up ball by ball', () => {
  const busiest = [...matchups(matches)].sort((a, b) => b.balls - a.balls)[0];
  const r = rivalry(matches, busiest.batterKey, busiest.bowlerKey)!;
  assert.equal(r.balls, busiest.balls);
  assert.equal(r.meetings.reduce((n, x) => n + x.faced, 0), r.balls);
  assert.equal(r.meetings.reduce((n, x) => n + x.runs, 0), r.runs);
  assert.equal(r.dismissals.length, r.outs);
  assert.equal(r.meetings.length, r.matches);
  assert.equal(r.dots + r.singles + r.fours + r.sixes + r.outs <= r.balls + r.noBalls, true);
  // Newest meeting first.
  assert.ok(r.meetings.every((x, i) => i === 0 || x.date <= r.meetings[i - 1].date));
  if (r.reverse) assert.equal(r.reverse.batterKey, busiest.bowlerKey);
});

test('the verdict leans the right way', () => {
  const base = { id: 'x', batter: 'Sam Bat', bowler: 'Ben Ball', batterKey: 'a', bowlerKey: 'b', dots: 0, fours: 0, sixes: 0, matches: 2 };
  assert.equal(verdict({ ...base, balls: 12, runs: 24, outs: 0 }).side, 'batter');
  assert.equal(verdict({ ...base, balls: 12, runs: 8, outs: 2 }).side, 'bowler');
  assert.equal(verdict({ ...base, balls: 20, runs: 22, outs: 1 }).side, 'even');
  const v = verdict({ ...base, balls: 12, runs: 24, outs: 0 });
  assert.ok(v.edge > 0.5 && v.title.startsWith('Sam'));
});

test('the wider record book adds up', () => {
  const r = records(matches);
  assert.equal(r.summary.matches, 6);
  assert.ok(r.mostRuns[0].count >= r.mostRuns[1].count);
  assert.ok(r.mostWickets[0].count >= r.mostWickets[1].count);
  assert.ok(r.bestStrikeRate[0].rate >= r.bestStrikeRate[1].rate);
  assert.ok(r.bestEconomy[0].rate <= r.bestEconomy[1].rate);
  assert.ok(r.dearestOvers[0].runs >= r.dearestOvers[1].runs && r.dearestOvers[0].balls.length >= 6);
  const wins = [...r.biggestWinsByRuns, ...r.biggestWinsByWickets];
  assert.ok(wins.length > 0 && wins.every((w) => w.margin > 0));
  assert.equal(r.summary.runs, matches.flatMap((m) => matchState(m).innings.slice(0, 2)).reduce((n, s) => n + s.runs, 0));
});

test('the tug of war always leans the way of the verdict', () => {
  for (const m of matchups(matches)) {
    const v = verdict(m);
    if (v.side === 'batter') assert.ok(v.edge >= 0.6, m.id);
    if (v.side === 'bowler') assert.ok(v.edge <= 0.4, m.id);
    if (v.side === 'even') assert.ok(v.edge > 0.4 && v.edge < 0.6, m.id);
  }
});

test('a rivalry is judged against how the two usually go, and not called on a handful of balls', () => {
  const base = { batter: 'Sam Bat', bowler: 'Ben Ball', dots: 0, fours: 0, sixes: 0, matches: 2 };
  const duel = (id: string, batterKey: string, bowlerKey: string, balls: number, runs: number, outs: number) => ({ ...base, id, batterKey, bowlerKey, balls, runs, outs });
  // Sam usually scores at 200 and is out every 60 balls. 30 off 24 and out twice to Ben is Ben's, though alone it
  // would look even (out every 12 balls, 15 a time).
  const sam = [duel('s1', 'sam', 'x', 60, 120, 1), duel('s2', 'sam', 'y', 60, 120, 1), duel('sb', 'sam', 'ben', 24, 30, 2)];
  const others = [duel('o1', 'p', 'ben', 60, 72, 3), duel('o2', 'q', 'x', 60, 72, 3), duel('o3', 'r', 'y', 60, 72, 3)];
  const ctx = rivalryContext([...sam, ...others]);
  const v = verdict(sam[2], ctx);
  assert.equal(v.side, 'bowler', v.line);
  assert.ok(v.batterUsual && Math.round(v.batterUsual.sr) === 200);
  // Batting through 24 balls of a bowler who usually takes a wicket every 20, never out, is the batter's.
  assert.equal(verdict(duel('pb', 'p2', 'ben', 24, 30, 0), ctx).side, 'batter');
  // A wicket in three balls is a start, not a verdict.
  const early = verdict(duel('e', 'sam', 'ben', 3, 0, 1), ctx);
  assert.equal(early.early, true);
  assert.equal(early.side, 'even');
  assert.ok(early.edge >= 0.42 && early.edge <= 0.58);
  assert.equal(BALLS_TO_CALL, 8);
});

test('a no-ball is never a dot ball in a rivalry', () => {
  for (const m of matchups(matches)) assert.ok(m.dots + m.outs <= m.balls);
});
