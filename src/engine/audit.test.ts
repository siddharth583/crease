/// <reference types="node" />
// The bugs the logic audit found (October 2026), each pinned so it stays fixed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, mergeMatches, parseBackup } from './backup.ts';
import { addEvent, matchState, newMatch, setOvers, startSuperOver } from './engine.ts';
import { careerStats, keyFor, playerOfTheMatch, seriesState, setRegulars } from './stats.ts';
import type { BallEvent, InningsEvent, Match, Rules, Team } from './types.ts';

const team = (id: string, names: string[]): Team => ({ id, name: id.toUpperCase(), players: names.map((n, i) => ({ id: `${id}${i + 1}`, name: n })) });
const rules: Rules = { overs: 1, playersPerSide: 3, extraRun: 1, reball: true, lastManStands: false };
const play = (m: Match, ...events: InningsEvent[]) => events.reduce(addEvent, m);
const ball = (runs: number): BallEvent => ({ type: 'ball', runs });
const over = (...runs: number[]) => runs.map(ball);

/** A one-over match: A make `a` (six balls), B make `b`. */
function oneOver(id: string, a: number[], b: number[], names: [string[], string[]] = [['a1', 'a2', 'a3'], ['b1', 'b2', 'b3']]) {
  let m = newMatch(id, [team('a', names[0]), team('b', names[1])], rules, { winner: 'a', choice: 'bat' });
  m = play(m, { type: 'openers', striker: 'a1', nonStriker: 'a2' }, { type: 'bowler', bowler: 'b1' }, ...over(...a));
  return play(m, { type: 'openers', striker: 'b1', nonStriker: 'b2' }, { type: 'bowler', bowler: 'a1' }, ...over(...b));
}
const tied = () => oneOver('t', [1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1]);

test('a match that went to a super over survives a match file', () => {
  let m = startSuperOver(tied());
  m = play(m, { type: 'openers', striker: 'b1', nonStriker: 'b2' }, { type: 'bowler', bowler: 'a1' }, ...over(0, 0, 0, 0, 0, 0));
  m = play(m, { type: 'openers', striker: 'a1', nonStriker: 'a2' }, { type: 'bowler', bowler: 'b1' }, ball(4));
  assert.equal(matchState(m).result, 'A won the super over');
  const back = parseBackup(JSON.stringify(makeBackup([m], m.teams)));
  assert.equal(back.matches.length, 1);
  assert.equal(back.skipped, 0);
});

test('the overs can’t be changed in a super over: it would reopen the first innings', () => {
  const m = play(startSuperOver(tied()), { type: 'openers', striker: 'b1', nonStriker: 'b2' });
  assert.equal(setOvers(m, 3), m);
});

test('a series with ties in it goes to the side that leads once nobody can catch them', () => {
  const series = (n: number) => ({ id: 's', name: 'Cup', of: 3, number: n });
  const win = { ...oneOver('w', [4, 4, 4, 4, 4, 4], [1, 1, 1, 1, 1, 1]), series: series(1) };
  const tie2 = { ...tied(), id: 't2', series: series(2) };
  const tie3 = { ...tied(), id: 't3', series: series(3) };
  const s = seriesState([win, tie2, tie3]);
  assert.equal(s.winner, 'A');
  assert.match(s.status, /win the series 1–0/);
  // Two up with one to play is won already.
  const s5 = seriesState([1, 2].map((n) => ({ ...oneOver(`w${n}`, [4, 4, 4, 4, 4, 4], [1, 1, 1, 1, 1, 1]), series: { ...series(n), of: 3 } })));
  assert.equal(s5.winner, 'A');
});

test('a regular who plays as the common player keeps one career', () => {
  setRegulars(['Joker']);
  const t = team('a', ['Joker']);
  assert.equal(keyFor(t, { name: 'Joker', common: true }), keyFor(t, { name: 'joker' }));
  setRegulars([]);
});

test('a blank name can’t be Man of the Match', () => {
  const m = oneOver('p', [6, 6, 6, 6, 6, 6], [0, 0, 0, 0, 0, 0], [['Player 1', 'Player 2', 'Player 3'], ['b1', 'b2', 'b3']]);
  const mom = playerOfTheMatch(m);
  assert.ok(!mom || !/^Player \d/.test(mom.name), mom?.name);
});

test('a tie is neither a win nor a loss in a player’s history', () => {
  const c = careerStats([tied()]).find((x) => x.name === 'a1')!;
  assert.equal(c.history[0].won, null);
});

test('an imported copy saved later replaces the match, even with fewer balls; an older one never does', () => {
  const m = oneOver('u', [1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0]);
  const mine = { ...m, updatedAt: 1000 };
  const fixed = { ...m, mom: 'b1', updatedAt: 2000 };
  assert.equal(mergeMatches([mine], [fixed]).updated, 1);
  assert.equal(mergeMatches([fixed], [mine]).updated, 0);
});
