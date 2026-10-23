/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSeason } from '../demo/sampleSeason.ts';
import { matchState } from './engine.ts';
import { headToHead, matchups, records } from './records.ts';

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
