/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dlsTarget, resources } from './dls.ts';

test('the table: 20 overs, none down is 100; nothing left is nothing', () => {
  assert.equal(resources(120, 0), 100);
  assert.equal(resources(0, 0), 0);
  assert.equal(resources(60, 4), 50.0);
  assert.equal(resources(60, 10), 0);
  // Half an over interpolates between whole overs.
  assert.equal(resources(9, 0), (6.4 + 12.7) / 2);
});

test('the handbook example: 256 in 50 overs, chase cut to 30 overs before it starts, target 193', () => {
  const t = dlsTarget({ firstRuns: 256, originalOvers: 50, interruptions: [{ innings: 1, balls: 0, wickets: 0, before: 50, after: 30 }], g: 245 });
  assert.equal(t.r2, 75.1);
  assert.equal(t.target, 193);
});

test('a chase interrupted midway loses only what was left', () => {
  // 10-over game: 90 batting first. Chase at 5 overs, 2 down, cut to 8 overs (3 overs lost).
  const t = dlsTarget({ firstRuns: 90, originalOvers: 10, interruptions: [{ innings: 1, balls: 30, wickets: 2, before: 10, after: 8 }], g: 80, sideSize: 11 });
  const lost = resources(30, 2) - resources(18, 2);
  const r2 = ((resources(60, 0) - lost) / resources(60, 0)) * 100;
  assert.equal(t.target, Math.floor((90 * r2) / 100) + 1);
  assert.ok(t.target < 90);
});

test('first innings cut short: the chasing side has more resources, so G adds to the target', () => {
  // First innings stopped at 6 overs (1 down) of 10, and the chase gets 6 overs from the start.
  const t = dlsTarget({ firstRuns: 50, originalOvers: 10, interruptions: [{ innings: 0, balls: 36, wickets: 1, before: 10, after: 6 }], g: 80 });
  assert.ok(t.r2 > t.r1);
  assert.equal(t.target, Math.floor(50 + (80 * (t.r2 - t.r1)) / 100) + 1);
});

test('wickets scale to the side size: 7 down of 8 is all out', () => {
  assert.equal(
    dlsTarget({ firstRuns: 60, originalOvers: 10, interruptions: [{ innings: 1, balls: 30, wickets: 7, before: 10, after: 8 }], g: 80, sideSize: 8 }).r2,
    100,
    'a side that is all out loses nothing to the rain',
  );
});
