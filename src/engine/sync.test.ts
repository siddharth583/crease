/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, planMatches, planShared, type RemoteMatch } from './sync.ts';
import type { Match } from './types.ts';

const match = (id: string, updatedAt: number, runs = 0) => ({ id, createdAt: 1, updatedAt, teams: [], innings: [{ events: [{ type: 'ball', runs }] }] }) as unknown as Match;
const remote = (m: Match): RemoteMatch => ({ json: JSON.stringify(m), updatedAt: m.updatedAt ?? 0 });

test('matches: new ones go both ways, the newer copy of the same match wins', () => {
  const mineOnly = match('a', 5);
  const theirsOnly = match('b', 5);
  const same = match('c', 5);
  const mineNewer = match('d', 9, 4);
  const theirsNewer = match('e', 9, 6);
  const plan = planMatches(
    [mineOnly, same, mineNewer, match('e', 3)],
    new Map([
      ['b', remote(theirsOnly)],
      ['c', remote(same)],
      ['d', remote(match('d', 3))],
      ['e', remote(theirsNewer)],
    ]),
    {},
  );
  assert.deepEqual(plan.send.map((m) => m.id).sort(), ['a', 'd']);
  assert.deepEqual(plan.take.map((m) => m.id).sort(), ['b', 'e']);
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.bury, []);
  assert.ok(plan.agreed.c && plan.agreed.b && plan.agreed.e);
});

test('matches: deleted on this phone is marked deleted in the club, and deleted in the club goes here', () => {
  const gone = match('g', 5);
  const plan = planMatches([match('h', 5)], new Map([['g', remote(gone)], ['h', { deleted: true, updatedAt: 8 }]]), { g: fingerprint(JSON.stringify(gone)) });
  assert.deepEqual(plan.bury, ['g']);
  assert.deepEqual(plan.remove, ['h']);
  // A match changed here after it was deleted elsewhere comes back.
  const kept = planMatches([match('h', 9)], new Map([['h', { deleted: true, updatedAt: 8 }]]), {});
  assert.deepEqual(kept.send.map((m) => m.id), ['h']);
});

test('shared things: the side that changed wins; a phone joining takes the club’s', () => {
  const old = '{"v":1}';
  assert.equal(planShared('{"v":2}', null, undefined), 'send', 'nothing in the club yet');
  assert.equal(planShared(old, old, fingerprint(old)), 'none');
  assert.equal(planShared('{"v":2}', old, fingerprint(old)), 'send', 'changed here');
  assert.equal(planShared(old, '{"v":3}', fingerprint(old)), 'take', 'changed in the club');
  assert.equal(planShared('{"v":2}', '{"v":3}', fingerprint(old)), 'take', 'both: the club wins');
  assert.equal(planShared('{"v":2}', '{"v":3}', undefined), 'take', 'first sync on this phone');
});
