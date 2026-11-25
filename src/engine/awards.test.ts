/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSeason } from '../demo/sampleSeason.ts';
import { seasonAwards } from './awards.ts';
import { careerStats } from './stats.ts';

const { matches } = sampleSeason(new Date('2026-10-23T12:00:00Z'));

test('the season’s caps go to the leaders of the record book', () => {
  const awards = seasonAwards(matches);
  const careers = careerStats(matches);
  const orange = awards.find((a) => a.id === 'orange')!;
  const purple = awards.find((a) => a.id === 'purple')!;
  assert.equal(Number(orange.winners[0].value), Math.max(...careers.map((c) => c.batting.runs)));
  assert.equal(Number(purple.winners[0].value), Math.max(...careers.map((c) => c.bowling.wickets)));
  for (const a of awards) {
    assert.ok(a.winners.length >= 1 && a.winners.length <= 3, a.id);
    assert.ok(a.winners.every((w) => w.name && w.key), a.id);
  }
});

test('rating awards need enough matches, and Most Improved only goes to someone who did improve', () => {
  const awards = seasonAwards(matches);
  const mvp = awards.find((a) => a.id === 'mvp');
  assert.ok(mvp && mvp.winners.every((w) => careerStats(matches).find((c) => c.key === w.key)!.matches >= 3));
  assert.ok(mvp.winners.every((w, i, xs) => i === 0 || Number(xs[i - 1].value) >= Number(w.value)));
  for (const w of awards.find((a) => a.id === 'improved')?.winners ?? []) assert.ok(Number(w.value) > 0);
  assert.deepEqual(seasonAwards([]), []);
});
