/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSeason } from '../demo/sampleSeason.ts';
import { matchState } from './engine.ts';
import { headToHead, matchups, records, rivalry, verdict } from './records.ts';

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

test('head to head adds up', () => {
  const h = headToHead(matches, 'Copan A', 'copan b');
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
