/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSeason } from '../demo/sampleSeason.ts';
import { headToHead, teamNames } from './records.ts';
import { teamProfile } from './teamPage.ts';

const { matches } = sampleSeason(new Date('2026-10-23T12:00:00Z'));

test('a team page adds up: its record, its streak, its leaders', () => {
  const [a, b] = teamNames(matches);
  const t = teamProfile(matches, a);
  const u = teamProfile(matches, b);
  assert.equal(t.played, t.won + t.lost + t.tied);
  const h = headToHead(matches, a, b);
  assert.equal(t.won, h.winsA);
  assert.equal(u.won, h.winsB);
  assert.equal(t.won, u.lost, 'one side’s wins are the other’s losses');
  assert.ok(t.results.every((r, i, xs) => i === 0 || xs[i - 1].date >= r.date), 'newest first');
  assert.equal(t.streak?.outcome, t.results[0]?.outcome);
  assert.ok(t.highest && t.lowest && t.highest.runs >= t.lowest.runs);
  assert.ok(t.runs.length > 0 && t.runs.every((x, i, xs) => i === 0 || xs[i - 1].value >= x.value));
  assert.ok(t.wickets.every((x) => x.value > 0 && x.key));
  assert.equal(teamProfile(matches, `  ${a.toUpperCase()} `).played, t.played, 'any case and spacing');
  assert.equal(teamProfile(matches, 'Nobody XI').played, 0);
});
