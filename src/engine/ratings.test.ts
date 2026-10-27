/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSeason } from '../demo/sampleSeason.ts';
import { matchRatings, playerRatings, ratedSquad, squadRatings, MATCHES_TO_RATE } from './ratings.ts';
import { DEFAULT_SQUAD } from './squad.ts';
import { setRegulars } from './stats.ts';

setRegulars(DEFAULT_SQUAD.map((p) => p.name));
const season = sampleSeason(new Date('2026-10-23T12:00:00Z'));

test('every player gets a rating out of 10 for each match they play a part in', () => {
  for (const m of season.matches) {
    const ratings = [...matchRatings(m).values()];
    assert.ok(ratings.length >= 10, `${m.id}: most of both sides did something`);
    for (const r of ratings) assert.ok(r.rating >= 1 && r.rating <= 10, `${r.rating} is out of 10`);
  }
});

test('the Man of the Match is among the best rated of their match', () => {
  for (const m of season.matches) {
    const top = [...matchRatings(m).values()].sort((a, b) => b.rating - a.rating);
    assert.ok(top[0].rating >= 7.5, `${m.id}: the best game rates highly (${top[0].rating})`);
  }
});

test('the squad gets form and stars from its matches; the rest keep what was set', () => {
  const ratings = squadRatings(season.matches, DEFAULT_SQUAD);
  const played = [...ratings.values()].filter((r) => r.matches >= MATCHES_TO_RATE);
  assert.ok(played.length >= 12, 'the regulars who played are rated');
  for (const r of played) {
    assert.ok(r.stars && r.form !== null);
    assert.ok(r.history.length >= MATCHES_TO_RATE);
    assert.ok(r.history[0].date >= r.history[r.history.length - 1].date, 'newest first');
  }
  // Someone who hasn't played keeps the stars set by hand, and a hand-set player keeps theirs too.
  const fresh = DEFAULT_SQUAD.find((p) => p.name === 'Sejal Chauhan')!;
  assert.equal(ratings.get(fresh.id)!.stars, null);
  const squad = DEFAULT_SQUAD.map((p) => (p.name === 'Nihal Walia' ? { ...p, manual: true, bat: 1 as const } : p));
  const rated = ratedSquad(season.matches, squad);
  assert.equal(rated.find((p) => p.name === 'Nihal Walia')!.bat, 1);
  assert.deepEqual(rated.find((p) => p.name === 'Sejal Chauhan'), fresh);
});

test("a player's page shows the same form and ratings as the squad list", () => {
  const squad = squadRatings(season.matches, DEFAULT_SQUAD);
  let checked = 0;
  for (const r of squad.values()) {
    if (!r.history.length) continue;
    const page = playerRatings(season.matches, r.key);
    assert.equal(page.form, r.form, r.name);
    assert.deepEqual(page.history.map((h) => h.rating), r.history.map((h) => h.rating), r.name);
    checked++;
  }
  assert.ok(checked > 5);
  assert.deepEqual(playerRatings(season.matches, 'nobody'), { history: [], form: null });
});
