/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addEvent, canChangeLegality, matchState, newMatch, replaceBall, setBowlerFrom } from './engine.ts';
import type { BallEvent, InningsEvent, Match, Rules, Team } from './types.ts';

const team = (id: string, n: number): Team => ({
  id,
  name: id.toUpperCase(),
  players: Array.from({ length: n }, (_, i) => ({ id: `${id}${i + 1}`, name: `${id}${i + 1}` })),
});
const rules = (r: Partial<Rules> = {}): Rules => ({ overs: 3, playersPerSide: 4, extraRun: 1, reball: true, lastManStands: false, ...r });
const setup = () => newMatch('m', [team('a', 4), team('b', 4)], rules(), { winner: 'a', choice: 'bat' });
const play = (m: Match, ...events: InningsEvent[]) => events.reduce(addEvent, m);
const ball = (runs: number, extra?: BallEvent['extra']): BallEvent => ({ type: 'ball', runs, extra });
const bowler = (id: string): InningsEvent => ({ type: 'bowler', bowler: id });
const start = (m: Match) => play(m, { type: 'openers', striker: 'a1', nonStriker: 'a2' }, bowler('b1'));
/** The event index of the n-th delivery (0-based) in innings 0. */
const nth = (m: Match, n: number) => m.innings[0].events.map((e, i) => (e.type === 'ball' ? i : -1)).filter((i) => i >= 0)[n];

test('a bowler can hand over mid-over: each is credited with the balls they bowled', () => {
  let m = start(setup());
  m = play(m, ball(1), ball(0), bowler('b2'), ball(4), ball(0), ball(0), ball(0));
  const s = matchState(m).innings[0];
  const b1 = s.bowlers.find((b) => b.id === 'b1')!;
  const b2 = s.bowlers.find((b) => b.id === 'b2')!;
  assert.deepEqual([b1.balls, b1.runs, b2.balls, b2.runs], [2, 1, 4, 4]);
  assert.equal(s.legalBalls, 6);
  assert.deepEqual(s.overBowlers[0], ['b1', 'b2']);
  assert.deepEqual(s.barred, ['b1', 'b2'], 'neither may bowl the next over');
  assert.equal(s.lastOverBowler, 'b2');
  assert.equal(s.status, 'bowler');
});

test('an over split between two bowlers is nobody’s maiden', () => {
  let m = start(setup());
  m = play(m, ball(0), ball(0), ball(0), bowler('b2'), ball(0), ball(0), ball(0));
  const s = matchState(m).innings[0];
  assert.equal(s.bowlers.reduce((n, b) => n + b.maidens, 0), 0);
});

test('setBowlerFrom puts a new bowler on partway through a finished over, and takes it away again', () => {
  let m = start(setup());
  m = play(m, ball(1), ball(0), ball(2), ball(0), ball(0), ball(1), bowler('b3'), ball(0), ball(0), ball(0), ball(0), ball(0), ball(0));
  const changed = setBowlerFrom(m, 0, nth(m, 3), 'b2');
  assert.notEqual(changed, m);
  const s = matchState(changed).innings[0];
  assert.deepEqual(s.overBowlers.slice(0, 2), [['b1', 'b2'], ['b3']]);
  assert.equal(s.bowlers.find((b) => b.id === 'b1')!.runs, 3);
  assert.equal(s.bowlers.find((b) => b.id === 'b2')!.runs, 1);
  // Picking b1 again at that ball removes the change.
  const back = setBowlerFrom(changed, 0, nth(changed, 3), 'b1');
  assert.deepEqual(back.innings[0].events, m.innings[0].events);
});

test('setBowlerFrom at the first ball of an over changes who bowled the over', () => {
  let m = start(setup());
  m = play(m, ball(0), ball(0), ball(0), ball(0), ball(0), ball(0), bowler('b3'), ball(4), ball(0), ball(0), ball(0), ball(0), ball(0));
  const fixed = setBowlerFrom(m, 0, nth(m, 6), 'b4');
  const s = matchState(fixed).innings[0];
  assert.deepEqual(s.overBowlers.slice(0, 2), [['b1'], ['b4']]);
  assert.equal(fixed.innings[0].events.length, m.innings[0].events.length);
  assert.equal(s.bowlers.find((b) => b.id === 'b4')!.runs, 4);
});

test('setBowlerFrom refuses a bowler who would bowl two overs in a row', () => {
  let m = start(setup());
  m = play(m, ball(0), ball(0), ball(0), ball(0), ball(0), ball(0), bowler('b3'), ball(0), ball(0), ball(0), ball(0), ball(0), ball(0));
  assert.equal(setBowlerFrom(m, 0, nth(m, 9), 'b1'), m, 'b1 bowled the over before');
  assert.equal(setBowlerFrom(m, 0, nth(m, 4), 'b3'), m, 'b3 bowls the over after');
  assert.notEqual(setBowlerFrom(m, 0, nth(m, 4), 'b2'), m);
});

test('a mid-over change doesn’t stop the over being bowled from taking a wide', () => {
  let m = start(setup());
  m = play(m, ball(0), ball(0), bowler('b2'), ball(1));
  assert.ok(canChangeLegality(m, 0, nth(m, 0)));
  const wide = replaceBall(m, 0, nth(m, 0), ball(0, 'wide'));
  assert.notEqual(wide, m);
  assert.equal(matchState(wide).innings[0].legalBalls, 2);
});

test('an edit is refused if the chase would have been won before its last balls', () => {
  let m = start(setup());
  // First innings: 6 runs in 3 overs.
  m = play(m, ball(1), ball(1), ball(1), ball(1), ball(1), ball(1), bowler('b2'));
  for (let i = 0; i < 6; i++) m = play(m, ball(0));
  m = play(m, bowler('b1'));
  for (let i = 0; i < 6; i++) m = play(m, ball(0));
  // The chase: 7 to win, got with a six and a single.
  m = play(m, { type: 'openers', striker: 'b1', nonStriker: 'b2' }, bowler('a1'), ball(6), ball(1));
  assert.ok(matchState(m).result?.startsWith('B won'));
  // Making the first innings 1 run smaller means the six alone won it: the single after can't stand.
  const first = m.innings[0].events.findIndex((e) => e.type === 'ball');
  assert.equal(replaceBall(m, 0, first, ball(0)), m);
  // A run more is fine: the chase still needs its second ball, and simply ends level.
  const more = replaceBall(m, 0, first, ball(2));
  assert.notEqual(more, m);
  assert.equal(matchState(more).result, null, 'the chase is back on: B need one more');
});
