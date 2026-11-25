/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSeason } from '../demo/sampleSeason.ts';
import { matchState } from './engine.ts';
import { chaseChance, chaseTimeline, type ChaseSituation } from './winProb.ts';

const { matches } = sampleSeason(new Date('2026-10-23T12:00:00Z'));
const base: ChaseSituation = { need: 40, ballsLeft: 30, wickets: 2, maxWickets: 10, ownRuns: 30, ownBalls: 30, parRate: 1.3 };

test('a chase is won at the target and lost with no balls or wickets left', () => {
  assert.equal(chaseChance({ ...base, need: 0 }), 1);
  assert.equal(chaseChance({ ...base, need: -3 }), 1);
  assert.equal(chaseChance({ ...base, ballsLeft: 0 }), 0);
  assert.equal(chaseChance({ ...base, wickets: 10 }), 0);
  const live = chaseChance(base);
  assert.ok(live > 0.01 && live < 0.99);
});

test('more runs to get, fewer balls or fewer wickets in hand all cut the chance', () => {
  const p = chaseChance(base);
  assert.ok(chaseChance({ ...base, need: 55 }) < p);
  assert.ok(chaseChance({ ...base, ballsLeft: 18 }) < p);
  assert.ok(chaseChance({ ...base, wickets: 6 }) < p);
  assert.ok(chaseChance({ ...base, need: 10 }) > p);
});

test('the sample season’s chases end where the result says', () => {
  let chases = 0;
  for (const m of matches) {
    const st = matchState(m);
    const chase = st.innings[1];
    if (!chase || chase.target === null) continue;
    const line = chaseTimeline(m, chase.target);
    assert.ok(line.length > 1, 'a point for the start and each ball');
    assert.ok(line.every((p) => p.chance >= 0 && p.chance <= 1));
    assert.equal(line[0].balls, 0);
    assert.equal(line[line.length - 1].runs, chase.runs);
    const last = line[line.length - 1];
    if (st.winner && !st.drawn) {
      chases += 1;
      const chaseWon = st.winner === chase.battingTeam.id;
      if (chase.runs >= chase.target || chase.status === 'done') assert.equal(last.chance, chaseWon ? 1 : 0, m.id);
    }
  }
  assert.ok(chases > 0);
});
