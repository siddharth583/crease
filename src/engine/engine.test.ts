/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addEvent, addPlayer, movePlayer, describeEvent, dismissal, highlights, matchState, newMatch, oversLeft, replaceBall, replaceOver, setOvers, startSuperOver, undo, type OverBall } from './engine.ts';
import { momChoices, playerOfTheMatch } from './stats.ts';
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
  assert.deepEqual(s.extras, { wide: 1, noball: 1, bye: 2, legbye: 0, penalty: 0 });
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
  assert.equal(setOvers(m, 0).interruptions?.[0].balls, 6, 'the cut is noted where the innings stood');
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

test('man of the match goes to the winners unless a loser did half as much again, and can be picked by hand', () => {
  // A: 12 off the first over, then 12 more. B chase 25 and fall short, but b1 hits 20.
  let m = start(setup({ overs: 2 }));
  m = play(m, ball(2), ball(2), ball(2), ball(2), ball(2), ball(2), { type: 'bowler', bowler: 'b2' }, ball(2), ball(2), ball(2), ball(2), ball(2), ball(2));
  m = start(m, 'b1', 'b2', 'a1');
  m = play(m, ball(4), ball(4), ball(4), ball(4), ball(4), ball(0), { type: 'bowler', bowler: 'a2' }, ball(1), ball(0), ball(0), ball(0), ball(0), ball(0));
  assert.ok(matchState(m).result?.startsWith('A won'));
  // The losers' best takes it only with half as much again as the winners' best.
  const choices = momChoices(m);
  const bestA = choices.find((c) => c.team === 'A')!;
  const bestB = choices.find((c) => c.team === 'B')!;
  const pick = playerOfTheMatch(m)!;
  assert.equal(pick.team, bestB.score >= bestA.score * 1.5 ? 'B' : 'A');
  // Picked by hand, the choice stands, even for someone who did little.
  const chosen = playerOfTheMatch({ ...m, mom: 'a4' })!;
  assert.equal(chosen.name, 'a4');
  assert.equal(chosen.summary, 'did not bat or bowl');
});

test('a tight spell earns its bowler more than an expensive one', () => {
  let m = start(setup({ overs: 2 }));
  m = play(m, ball(0), ball(1), ball(0), ball(1), ball(0), ball(0), { type: 'bowler', bowler: 'b2' }, ball(6), ball(6), ball(6), ball(4), ball(4), ball(4));
  m = start(m, 'b1', 'b2', 'a1');
  m = play(m, ball(1), ball(1), ball(1), ball(1), ball(1), ball(1), { type: 'bowler', bowler: 'a2' }, ball(1), ball(1), ball(1), ball(1), ball(1), ball(1));
  const score = (name: string) => momChoices(m).find((c) => c.name === name)!.score;
  assert.ok(score('b1') > 0, 'two runs in a 3-a-ball match');
  assert.ok(score('b2') < 0, '30 in an over');
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
  assert.equal(s.overs[0][0].label, 'BWd');

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

test('a tie goes to a super over: one over, two wickets, the side that batted second goes first', () => {
  let m = start(setup({ overs: 1 }));
  m = play(m, ball(2), ball(0), ball(0), ball(0), ball(0), ball(0));
  m = start(m, 'b1', 'b2', 'a1');
  m = play(m, ball(2), ball(0), ball(0), ball(0), ball(0), ball(0));
  assert.equal(matchState(m).result, 'Match tied');
  m = startSuperOver(m);
  let st = matchState(m);
  assert.equal(st.result, null, 'not over until the super over is');
  assert.equal(st.current, 2);
  assert.equal(st.innings[2].battingTeam.id, 'b');
  // B: two wickets end it.
  const out = (p: string): BallEvent => ball(0, undefined, { kind: 'bowled', playerOut: p });
  m = play(m, { type: 'openers', striker: 'b1', nonStriker: 'b2' }, { type: 'bowler', bowler: 'a1' }, ball(4), out('b1'), { type: 'batter', batter: 'b3' }, out('b3'));
  st = matchState(m);
  assert.equal(st.innings[2].status, 'done');
  assert.equal(st.current, 3);
  m = play(m, { type: 'openers', striker: 'a1', nonStriker: 'a2' }, { type: 'bowler', bowler: 'b1' }, ball(6));
  st = matchState(m);
  assert.equal(st.result, 'A won the super over');
  assert.equal(st.winner, 'a');
});

test('undo takes away a super over that has not started', () => {
  let m = start(setup({ overs: 1 }));
  m = play(m, ball(0), ball(0), ball(0), ball(0), ball(0), ball(0));
  m = start(m, 'b1', 'b2', 'a1');
  m = play(m, ball(0), ball(0), ball(0), ball(0), ball(0), ball(0));
  const so = startSuperOver(m);
  assert.equal(so.innings.length, 4);
  assert.equal(undo(so).innings.length, 2);
});

test('rain: DLS sets the chase target when overs are cut', () => {
  // First innings: 8 runs in 2 overs, then the chase is cut to 1 over before it starts.
  let m = start(setup({ overs: 2 }, 11));
  m = play(m, ball(4), ball(4), ball(0), ball(0), ball(0), ball(0), { type: 'bowler', bowler: 'b2' }, ball(0), ball(0), ball(0), ball(0), ball(0), ball(0));
  m = setOvers(m, 1);
  const st = matchState(m);
  assert.equal(m.interruptions?.length, 1);
  // 1 over against 2 overs with no wicket down: 6.4 / 12.7 of resources.
  assert.equal(st.innings[1].target, Math.floor((8 * 6.4) / 12.7) + 1);
  m = start(m, 'b1', 'b2', 'a1');
  m = play(m, ball(4), ball(1));
  assert.match(matchState(m).result!, /\(DLS\)$/);
});

test('penalty runs and dead balls', () => {
  const m = play(start(setup()), { type: 'penalty', runs: 5 }, { type: 'deadBall' }, ball(1));
  const s = matchState(m).innings[0];
  assert.equal(s.runs, 6);
  assert.equal(s.extras.penalty, 5);
  assert.equal(s.legalBalls, 1);
});

test('a late player can bat', () => {
  let m = start(setup({}, 2));
  m = addPlayer(m, 'a', { id: 'a9', name: 'Late Larry' });
  m = play(m, ball(0, undefined, { kind: 'bowled', playerOut: 'a1' }));
  const s = matchState(m).innings[0];
  assert.equal(s.status, 'batter', 'two players would have been all out; the late one can come in');
  assert.deepEqual(s.available, ['a9']);
});

test('a wicket can be corrected but stays a wicket of the same batter', () => {
  const m = play(start(setup()), ball(0, undefined, { kind: 'bowled', playerOut: 'a1' }));
  const i = 2;
  const caught = replaceBall(m, 0, i, ball(0, undefined, { kind: 'caught', playerOut: 'a1', fielder: 'b3' }));
  assert.equal(dismissal(caught, matchState(caught).innings[0].batters[0]), 'c b3 b b1');
  assert.equal(replaceBall(m, 0, i, ball(0, undefined, { kind: 'bowled', playerOut: 'a2' })), m, 'a different batter is refused');
});

test('a first bounce is the umpire’s call (fair or wide); the second in the over is a no-ball', () => {
  const bounce = (call: 'fair' | 'wide', runs = 0): BallEvent => ({ type: 'ball', runs, bouncer: call });
  // No rule set: one an over, then no-balls.
  let m = play(start(setup()), bounce('wide'));
  let s = matchState(m).innings[0];
  assert.equal(s.extras.wide, 1, 'called wide');
  assert.equal(s.legalBalls, 0);
  m = play(m, bounce('fair', 2));
  s = matchState(m).innings[0];
  assert.equal(s.extras.noball, 1, 'the second bounce is a no-ball whatever the call');
  assert.equal(s.overs[0][1].label, 'BNb+2');
  // A fair first bounce is just a ball.
  m = play(start(setup()), bounce('fair', 4));
  s = matchState(m).innings[0];
  assert.equal(s.legalBalls, 1);
  assert.equal(s.overs[0][0].label, '4');
});

test('a ball in a finished over can’t change whether it counts on its own: the over is rewritten as a whole', () => {
  let m = start(setup({ overs: 3 }));
  m = play(m, ...Array.from({ length: 6 }, () => ball(0)));
  m = play(m, { type: 'bowler', bowler: 'b2' }, ball(1));
  const first = m.innings[0].events.findIndex((e) => e.type === 'ball');
  assert.equal(replaceBall(m, 0, first, ball(0, 'wide')), m);
  assert.equal(replaceBall(m, 0, first, null), m);
});

/** The over as it stands, ready to rewrite. */
const draftOf = (m: Match, o: number): OverBall[] =>
  matchState(m).innings[0].overs[o].map((b) => ({ ball: m.innings[0].events[b.event!] as BallEvent, bowler: b.bowler!, from: b.event }));

test('a bowled over is rewritten with its 6 fair balls: wides added in, and nothing after it moves', () => {
  let m = start(setup({ overs: 3 }));
  m = play(m, ...Array.from({ length: 6 }, () => ball(0)));
  m = play(m, { type: 'bowler', bowler: 'b2' }, ball(1), ball(1));
  const draft = draftOf(m, 0);
  draft[0] = { ...draft[0], ball: ball(0, 'wide') };
  draft[2] = { ...draft[2], ball: ball(0, 'wide') };
  // Two wides leave four fair balls: not an over yet.
  assert.match(String(replaceOver(m, 0, 0, draft)), /has 4\. Add 2/);
  const whole = [...draft, { ball: ball(6), bowler: 'b1' }, { ball: ball(4), bowler: 'b1' }];
  const fixed = replaceOver(m, 0, 0, whole);
  assert.equal(typeof fixed, 'object');
  const s = matchState(fixed as Match).innings[0];
  assert.equal(s.overs[0].length, 8);
  assert.equal(s.legalBalls, 8);
  assert.equal(s.runs, 2 + 6 + 4 + 2);
  assert.deepEqual(s.overBowlers.slice(0, 2), [['b1'], ['b2']]);
  assert.equal(s.bowlers.find((b) => b.id === 'b1')!.balls, 6);
  // Seven fair balls is one too many.
  assert.match(String(replaceOver(m, 0, 0, [...draftOf(m, 0), { ball: ball(1), bowler: 'b1' }])), /has 7/);
  // A wide after the sixth fair ball would spill into the next over.
  assert.match(String(replaceOver(m, 0, 0, [...draftOf(m, 0), { ball: ball(0, 'wide'), bowler: 'b1' }])), /sixth fair ball/);
});

test('rewriting an over can take a ball away, and a bowler can take over partway through it', () => {
  let m = start(setup({ overs: 3 }));
  m = play(m, ball(0, 'noball'), ...Array.from({ length: 6 }, () => ball(1)));
  m = play(m, { type: 'bowler', bowler: 'b2' }, ball(1));
  const draft = draftOf(m, 0).slice(1).map((d, i) => (i >= 3 ? { ...d, bowler: 'b3' } : d));
  const s = matchState(replaceOver(m, 0, 0, draft) as Match).innings[0];
  assert.equal(s.extras.noball, 0);
  assert.deepEqual(s.overBowlers.slice(0, 2), [['b1', 'b3'], ['b2']]);
  assert.equal(s.bowlers.find((b) => b.id === 'b3')!.balls, 3);
});

test('a batter coming in after a wicket stays after it when the over is rewritten', () => {
  let m = start(setup({ overs: 3 }));
  m = play(m, ball(1), ball(0, undefined, { kind: 'bowled', playerOut: 'a2' }), { type: 'batter', batter: 'a3' }, ball(0), ball(0), ball(0), ball(0));
  m = play(m, { type: 'bowler', bowler: 'b2' }, ball(1));
  const draft = draftOf(m, 0);
  draft[0] = { ...draft[0], ball: ball(0, 'wide') };
  draft.push({ ball: ball(2), bowler: 'b1' });
  const s = matchState(replaceOver(m, 0, 0, draft) as Match).innings[0];
  assert.equal(s.wickets, 1);
  assert.ok(s.batters.some((b) => b.id === 'a3'));
  assert.equal(s.legalBalls, 7);
});

test('a player who hasn’t batted or bowled can switch sides mid-match', () => {
  let m = start(setup({ overs: 2 }, 4));
  m = play(m, ball(1), ball(0));
  // a3 hasn't batted yet: they can go to B, who now have five; a1 is batting and stays.
  const moved = movePlayer(m, 'a3') as Match;
  assert.equal(typeof moved, 'object');
  assert.equal(moved.teams[0].players.length, 3);
  assert.ok(moved.teams[1].players.some((p) => p.id === 'a3'));
  assert.match(String(movePlayer(m, 'a1')), /already batted/);
  assert.match(String(movePlayer(m, 'b1')), /already batted or bowled/);
  // A side can't be left with fewer than two.
  const thin = movePlayer(movePlayer(moved, 'a4') as Match, 'a2');
  assert.equal(typeof thin, 'string');
  // B can now be all out only after four wickets (five players).
  assert.equal(matchState(moved).innings[1].battingTeam.players.length, 5);
});

test('last man standing: the lone batter is credited with every run, after singles and over ends too', () => {
  let m = start(setup({ lastManStands: true, overs: 3 }, 3));
  m = play(m, ball(0, undefined, { kind: 'bowled', playerOut: 'a1' }), { type: 'batter', batter: 'a3' });
  m = play(m, ball(0, undefined, { kind: 'bowled', playerOut: 'a3' }));
  // a2 is on their own now: a single, then a four, then the over ends and another ball comes.
  m = play(m, ball(1), ball(4), ball(0), ball(0), { type: 'bowler', bowler: 'b2' }, ball(6));
  const s = matchState(m).innings[0];
  const a2 = s.batters.find((b) => b.id === 'a2')!;
  assert.equal(a2.runs, 11);
  assert.equal(s.runs, 11);
  assert.equal(s.striker, 'a2');
});
