/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addEvent, describeEvent, dismissal, highlights, matchState, newMatch, oversLeft, replaceBall, setOvers, undo } from './engine.ts';
import { playerOfTheMatch } from './stats.ts';
import type { BallEvent, InningsEvent, Match, Rules, Team } from './types.ts';

const team = (id: string, n: number): Team => ({
  id,
  name: id.toUpperCase(),
  players: Array.from({ length: n }, (_, i) => ({ id: `${id}${i + 1}`, name: `${id}${i + 1}` })),
});

const rules = (r: Partial<Rules> = {}): Rules => ({
  overs: 2,
  playersPerSide: 4,
  extraRun: 1,
  reball: true,
  lastManStands: false,
  ...r,
});

const setup = (r?: Partial<Rules>, n = 4) =>
  newMatch('m', [team('a', n), team('b', n)], rules(r), { winner: 'a', choice: 'bat' });

const play = (m: Match, ...events: InningsEvent[]) => events.reduce(addEvent, m);
const ball = (runs: number, extra?: BallEvent['extra'], wicket?: BallEvent['wicket']): BallEvent => ({
  type: 'ball',
  runs,
  extra,
  wicket,
});
const start = (m: Match, striker = 'a1', non = 'a2', bowler = 'b1') =>
  play(m, { type: 'openers', striker, nonStriker: non }, { type: 'bowler', bowler });

test('toss decides who bats first', () => {
  const m = newMatch('m', [team('a', 4), team('b', 4)], rules(), { winner: 'a', choice: 'bowl' });
  assert.equal(m.innings[0].battingTeam, 'b');
});

test('odd runs rotate strike, over end rotates and asks for a bowler', () => {
  let m = start(setup());
  m = play(m, ball(1));
  let s = matchState(m).innings[0];
  assert.equal(s.striker, 'a2');
  m = play(m, ball(0), ball(0), ball(0), ball(0), ball(2));
  s = matchState(m).innings[0];
  assert.equal(s.legalBalls, 6);
  assert.equal(s.striker, 'a1', 'a2 faced the last ball, so a1 is on strike next over');
  assert.equal(s.status, 'bowler');
  assert.equal(s.lastOverBowler, 'b1');
});

test('wides and no-balls are re-bowled and charged to the bowler', () => {
  let m = start(setup());
  m = play(m, ball(0, 'wide'), ball(4, 'noball'), ball(2, 'bye'));
  const s = matchState(m).innings[0];
  assert.equal(s.runs, 1 + 5 + 2);
  assert.equal(s.legalBalls, 1);
  assert.deepEqual(s.extras, { wide: 1, noball: 1, bye: 2, legbye: 0 });
  const a1 = s.batters.find((b) => b.id === 'a1')!;
  assert.equal(a1.runs, 4);
  assert.equal(a1.balls, 2, 'no-ball and bye are faced, the wide is not');
  assert.equal(s.bowlers[0].runs, 6, 'byes are not charged to the bowler');
});

test('house rule: no penalty run and wides count as a ball', () => {
  let m = start(setup({ extraRun: 0, reball: false }));
  m = play(m, ball(0, 'wide'));
  const s = matchState(m).innings[0];
  assert.equal(s.runs, 0);
  assert.equal(s.legalBalls, 1);
});

test('wicket leaves a gap, new batter fills it, caught credits fielder', () => {
  let m = start(setup());
  m = play(m, ball(0, undefined, { kind: 'caught', playerOut: 'a1', fielder: 'b2' }));
  let s = matchState(m).innings[0];
  assert.equal(s.status, 'batter');
  assert.equal(s.wickets, 1);
  assert.equal(s.bowlers[0].wickets, 1);
  assert.equal(dismissal(m, s.batters[0]), 'c b2 b b1');
  m = play(m, { type: 'batter', batter: 'a3' });
  s = matchState(m).innings[0];
  assert.equal(s.striker, 'a3');
  assert.equal(s.status, 'live');
});

test('run out of the non-striker after a run is not the bowler’s wicket', () => {
  let m = start(setup());
  m = play(m, ball(1, undefined, { kind: 'runout', playerOut: 'a1', fielder: 'b3' }));
  const s = matchState(m).innings[0];
  assert.equal(s.striker, 'a2');
  assert.equal(s.nonStriker, null);
  assert.equal(s.bowlers[0].wickets, 0);
  assert.equal(s.fallOfWickets[0].runs, 1);
});

test('all out at players - 1, or batting alone with last man stands', () => {
  const out = (p: string) => ball(0, undefined, { kind: 'bowled', playerOut: p });
  let m = start(setup());
  m = play(m, out('a1'), { type: 'batter', batter: 'a3' }, out('a3'), { type: 'batter', batter: 'a4' }, out('a4'));
  assert.equal(matchState(m).innings[0].status, 'done');
  assert.equal(matchState(m).current, 1);

  let l = start(setup({ lastManStands: true }));
  l = play(l, out('a1'), { type: 'batter', batter: 'a3' }, out('a3'), { type: 'batter', batter: 'a4' }, out('a4'));
  const s = matchState(l).innings[0];
  assert.equal(s.status, 'live');
  assert.equal(s.striker, 'a2');
  assert.equal(s.nonStriker, null);
});

test('chase finishes the match as soon as the target is passed', () => {
  let m = setup({ overs: 1 });
  m = start(m);
  m = play(m, ball(4), ball(0), ball(0), ball(0), ball(0), ball(0));
  assert.equal(matchState(m).current, 1);
  m = start(m, 'b1', 'b2', 'a1');
  m = play(m, ball(6));
  const state = matchState(m);
  assert.equal(state.result, 'B won by 3 wickets');
  assert.equal(addEvent(m, ball(1)), m, 'nothing is scored after the result');
});

test('first innings side defends and ties are called', () => {
  let m = start(setup({ overs: 1 }));
  m = play(m, ball(2), ball(0), ball(0), ball(0), ball(0), ball(0));
  m = start(m, 'b1', 'b2', 'a1');
  const dots = [ball(1), ball(0), ball(0), ball(0), ball(0)];
  const won = play(m, ...dots, ball(0));
  assert.equal(matchState(won).result, 'A won by 1 run');
  const tied = play(m, ...dots, ball(1));
  assert.equal(matchState(tied).result, 'Match tied');
});

test('maidens and undo across the innings break', () => {
  let m = start(setup({ overs: 1 }));
  m = play(m, ball(0), ball(0), ball(0), ball(0), ball(0), ball(0));
  assert.equal(matchState(m).innings[0].bowlers[0].maidens, 1);
  assert.equal(matchState(m).current, 1);
  m = undo(m);
  const s = matchState(m);
  assert.equal(s.current, 0);
  assert.equal(s.innings[0].legalBalls, 5);
  assert.equal(s.innings[0].bowlers[0].maidens, 0);
});

test('retired batter can come back later and is not a wicket', () => {
  let m = start(setup());
  m = play(m, { type: 'retire', batter: 'a1' });
  let s = matchState(m).innings[0];
  assert.equal(s.wickets, 0);
  assert.equal(s.runs, 0);
  assert.equal(s.legalBalls, 0);
  assert.ok(s.available.includes('a1'));
  m = play(m, { type: 'batter', batter: 'a3' }, ball(0, undefined, { kind: 'bowled', playerOut: 'a3' }), {
    type: 'batter',
    batter: 'a1',
  });
  s = matchState(m).innings[0];
  assert.equal(s.striker, 'a1');
  assert.equal(dismissal(m, s.batters[0]), 'not out');
});

test('strike can be swapped by hand', () => {
  const m = play(start(setup()), { type: 'swap' });
  assert.equal(matchState(m).innings[0].striker, 'a2');
});

test('runs and wickets per over', () => {
  let m = start(setup());
  m = play(m, ball(4), ball(1), ball(0, 'wide'), ball(0), ball(0), ball(0), ball(2));
  m = play(m, { type: 'bowler', bowler: 'b2' }, ball(0, undefined, { kind: 'bowled', playerOut: 'a1' }));
  const s = matchState(m).innings[0];
  assert.deepEqual(s.overTotals, [
    { runs: 8, wickets: 0 },
    { runs: 0, wickets: 1 },
  ]);
});

test('ending an innings early starts the chase', () => {
  const m = play(start(setup()), ball(4), { type: 'endInnings' });
  const st = matchState(m);
  assert.equal(st.innings[0].status, 'done');
  assert.equal(st.current, 1);
  assert.equal(st.innings[1].target, 5);
});

test('free hit follows a no-ball and survives a wide', () => {
  let m = start(setup({ freeHit: true }));
  m = play(m, ball(0, 'noball'));
  assert.equal(matchState(m).innings[0].freeHit, true);
  m = play(m, ball(0, 'wide'));
  assert.equal(matchState(m).innings[0].freeHit, true);
  m = play(m, ball(1));
  assert.equal(matchState(m).innings[0].freeHit, false);
  assert.equal(matchState(play(start(setup()), ball(0, 'noball'))).innings[0].freeHit, false, 'off unless the rule is on');
});

test('a hat-trick is three of the bowler’s wickets in a row, across overs, not broken by a wide', () => {
  const out = (p: string): BallEvent => ball(0, undefined, { kind: 'bowled', playerOut: p });
  let m = start(setup({ overs: 3, lastManStands: true }, 6));
  m = play(m, ball(0), ball(0), ball(0), ball(0), ball(0), out('a1'));
  const before = matchState(m).innings[0];
  m = play(m, { type: 'batter', batter: 'a3' }, { type: 'bowler', bowler: 'b2' }, ball(0), ball(0), ball(0), ball(0), ball(0), ball(0));
  m = play(m, { type: 'bowler', bowler: 'b1' });
  // a2 faced the end of the last over, so a3 is at the striker's end now.
  const striker = () => matchState(m).innings[0].striker!;
  m = play(m, out(striker()), { type: 'batter', batter: 'a4' }, ball(0, 'wide'));
  assert.equal(matchState(m).innings[0].streaks.b1, 2, 'hat-trick ball, even after a wide');
  const mid = matchState(m).innings[0];
  m = play(m, out(striker()));
  const after = matchState(m).innings[0];
  assert.deepEqual(highlights(mid, after), [{ kind: 'hattrick', player: 'b1' }]);
  assert.equal(before.streaks.b1, 1);
});

test('fifty and maiden highlights', () => {
  let m = start(setup({ overs: 10 }));
  m = play(m, ball(6), ball(6), ball(6), ball(6), ball(6), ball(6)); // a1 36, then a2 on strike
  m = play(m, { type: 'bowler', bowler: 'b2' }, ball(1), ball(6), ball(6)); // a1 48
  const before = matchState(m).innings[0];
  m = play(m, ball(4));
  const after = matchState(m).innings[0];
  assert.deepEqual(highlights(before, after), [{ kind: 'fifty', player: 'a1', runs: 52 }]);

  let d = start(setup());
  d = play(d, ball(0), ball(0), ball(0), ball(0), ball(0));
  const b5 = matchState(d).innings[0];
  d = play(d, ball(0));
  assert.deepEqual(highlights(b5, matchState(d).innings[0]), [{ kind: 'maiden', player: 'b1' }]);
});

test('editing a past ball recomputes everything after it; wickets are left alone', () => {
  const m = play(start(setup()), ball(1), ball(4), ball(0, undefined, { kind: 'bowled', playerOut: 'a1' }));
  const idx = (n: number) => 2 + n; // openers and bowler come first
  const fixed = replaceBall(m, 0, idx(0), ball(2));
  const s = matchState(fixed).innings[0];
  assert.equal(s.runs, 6);
  assert.equal(s.batters.find((b) => b.id === 'a1')!.runs, 6, 'no strike change now, so a1 hit the four too');
  const removed = matchState(replaceBall(m, 0, idx(1), null)).innings[0];
  assert.equal(removed.runs, 1);
  assert.equal(removed.legalBalls, 2);
  assert.equal(replaceBall(m, 0, idx(2), ball(0)), m, 'a wicket ball is not edited here');
  assert.equal(matchState(m).innings[0].overs[0][1].event, idx(1));
});

test('per-bowler over limit and changing the overs', () => {
  let m = start(setup({ overs: 4, maxOversPerBowler: 1 }));
  m = play(m, ball(0), ball(0), ball(0), ball(0), ball(0), ball(1));
  const s = matchState(m).innings[0];
  assert.equal(oversLeft(m, s, 'b1'), 0);
  assert.equal(oversLeft(m, s, 'b2'), 1);
  assert.equal(setOvers(m, 0).rules.overs, 1, 'never below what was bowled');
  assert.equal(setOvers(m, 3).rules.overs, 3);
});

test('undo says what it undid', () => {
  const m = start(setup());
  assert.equal(describeEvent(m, ball(4), 'a1'), 'FOUR by a1');
  assert.equal(describeEvent(m, ball(1, 'wide'), 'a1'), 'wide + 1 run');
  assert.equal(describeEvent(m, ball(0, undefined, { kind: 'caught', playerOut: 'a2' }), 'a1'), 'wicket of a2');
});

test('player of the match', () => {
  let m = start(setup({ overs: 1 }));
  m = play(m, ball(6), ball(6), ball(0), ball(0), ball(0), ball(0));
  m = start(m, 'b1', 'b2', 'a3');
  const out = (p: string): BallEvent => ball(0, undefined, { kind: 'bowled', playerOut: p });
  m = play(m, out('b1'), { type: 'batter', batter: 'b3' }, out('b3'), { type: 'batter', batter: 'b4' }, out('b4'));
  const potm = playerOfTheMatch(m)!;
  assert.equal(potm.name, 'a3');
  assert.equal(potm.summary, '3/0');
});

test('two bowlers may bowl an extra over, the rest stop at the limit', () => {
  const over = (bowler: string, m: Match) => play(m, { type: 'bowler', bowler }, ball(0), ball(0), ball(0), ball(0), ball(0), ball(0));
  let m = play(start(setup({ overs: 10, maxOversPerBowler: 2, extraOverBowlers: 2 }, 8)), ball(0), ball(0), ball(0), ball(0), ball(0), ball(0));
  // b1 has 1 over. Bowl b2, b1, b2 so both have 2.
  m = over('b2', m);
  m = over('b1', m);
  m = over('b2', m);
  let s = matchState(m).innings[0];
  assert.equal(oversLeft(m, s, 'b1'), 1, 'one of two extra places is free');
  m = over('b1', m); // b1 bowls a 3rd
  m = over('b3', m);
  s = matchState(m).innings[0];
  assert.equal(oversLeft(m, s, 'b1'), 0);
  assert.equal(oversLeft(m, s, 'b2'), 1, 'b2 can still take the second extra place');
  m = over('b2', m);
  s = matchState(m).innings[0];
  assert.equal(oversLeft(m, s, 'b3'), 1, 'both extra places are used, so b3 stops at 2');
});

test('bouncers: fair up to the allowance, then called as a wide or no-ball, reset each over', () => {
  const bounce = (runs = 0): BallEvent => ({ type: 'ball', runs, bouncer: true });
  // Every bouncer called as a wide (the default).
  let m = play(start(setup({ bouncer: { fair: 0, calledAs: 'wide' } })), bounce());
  let s = matchState(m).innings[0];
  assert.equal(s.runs, 1);
  assert.equal(s.legalBalls, 0);
  assert.equal(s.overs[0][0].label, 'Bn');

  // One fair bouncer an over, then a no-ball.
  m = play(start(setup({ bouncer: { fair: 1, calledAs: 'noball' } })), bounce(4), bounce(2));
  s = matchState(m).innings[0];
  assert.equal(s.legalBalls, 1, 'the first was a fair ball');
  assert.equal(s.runs, 4 + 2 + 1);
  assert.equal(s.extras.noball, 1);
  assert.equal(s.batters[0].runs, 6, 'runs off the bat count, even on the called one');
  // Next over: a fair one again.
  m = play(m, ball(0), ball(0), ball(0), ball(0), ball(0), { type: 'bowler', bowler: 'b2' }, bounce());
  s = matchState(m).innings[0];
  assert.equal(s.legalBalls, 7);
  assert.equal(describeEvent(m, bounce(1), 'a1'), 'bouncer + 1 run');
});
