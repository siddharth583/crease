/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addEvent, matchState, newMatch } from './engine.ts';
import { battingAverage, bestFigures, careerStats, economy, playerKey, seriesState, setRegulars } from './stats.ts';
import type { BallEvent, InningsEvent, Match, Team } from './types.ts';

let seq = 0;
// Every match gets fresh ids, as the setup screen does: identity must come from the names.
const team = (name: string, players: string[]): Team => ({
  id: `${name}-${++seq}`,
  name,
  players: players.map((p) => ({ id: `${p}-${++seq}`, name: p })),
});
const id = (m: Match, name: string) => m.teams.flatMap((t) => t.players).find((p) => p.name === name)!.id;
const ball = (runs: number, wicket?: BallEvent['wicket']): BallEvent => ({ type: 'ball', runs, wicket });

function game(createdAt: number, script: (m: Match) => InningsEvent[]) {
  const m = newMatch(`m${createdAt}`, [team('Strikers', ['Rohit', 'Virat', 'Player 3']), team('royals ', ['Sam', 'Jos', 'Ben'])], {
    overs: 1,
    playersPerSide: 3,
    extraRun: 1,
    reball: true,
    lastManStands: false,
  }, { winner: 'x', choice: 'bat' });
  m.createdAt = createdAt;
  return script(m).reduce(addEvent, m);
}

const twoGames = () => [
  game(1, (m) => [
    { type: 'openers', striker: id(m, 'Rohit'), nonStriker: id(m, 'Virat') },
    { type: 'bowler', bowler: id(m, 'Sam') },
    ball(4),
    ball(6),
    ball(0, { kind: 'caught', playerOut: id(m, 'Rohit'), fielder: id(m, 'Jos') }),
    { type: 'batter', batter: id(m, 'Player 3') },
    ball(0),
    ball(0),
    ball(0),
  ]),
  game(2, (m) => [
    { type: 'openers', striker: id(m, 'Rohit'), nonStriker: id(m, 'Virat') },
    { type: 'bowler', bowler: id(m, 'Sam') },
    ball(0, { kind: 'bowled', playerOut: id(m, 'Rohit') }),
    { type: 'batter', batter: id(m, 'Player 3') },
    ball(2),
    ball(0),
    ball(0),
    ball(0),
    ball(0),
  ]),
];

test('adds a player up across matches by team and name', () => {
  const stats = careerStats(twoGames());
  const rohit = stats.find((c) => c.name === 'Rohit')!;
  assert.equal(rohit.matches, 2);
  assert.equal(rohit.batting.innings, 2);
  assert.equal(rohit.batting.runs, 10);
  assert.equal(rohit.batting.highest, 10);
  assert.equal(rohit.batting.ducks, 1);
  assert.equal(battingAverage(rohit), 5);
  assert.equal(rohit.history.length, 2);
  assert.equal(rohit.history[0].matchId, 'm2', 'newest match first');
});

test('team names match despite case and spaces', () => {
  const sam = careerStats(twoGames()).find((c) => c.name === 'Sam')!;
  assert.equal(sam.key, playerKey({ id: '', name: 'Royals', players: [] }, 'sam'));
  assert.equal(sam.matches, 2);
});

test('bowling, best figures and fielding', () => {
  const stats = careerStats(twoGames());
  const sam = stats.find((c) => c.name === 'Sam')!;
  assert.equal(sam.bowling.balls, 12);
  assert.equal(sam.bowling.wickets, 2);
  assert.equal(sam.bowling.runs, 12);
  assert.equal(bestFigures(sam), '1/2');
  assert.equal(economy(sam), 6);
  assert.equal(stats.find((c) => c.name === 'Jos')!.fielding.catches, 1);
});

test('not out innings and placeholder names', () => {
  const stats = careerStats(twoGames());
  const virat = stats.find((c) => c.name === 'Virat')!;
  assert.equal(virat.batting.innings, 2);
  assert.equal(virat.batting.notOuts, 2);
  assert.equal(battingAverage(virat), null);
  assert.ok(!stats.some((c) => c.name === 'Player 3'));
});

/** A finished one-over game: the side batting first makes 4; the chase makes `chase` (6 wins it). */
function quickGame(n: number, chase: number): Match {
  return game(n, (m) => [
    { type: 'openers', striker: id(m, 'Rohit'), nonStriker: id(m, 'Virat') },
    { type: 'bowler', bowler: id(m, 'Sam') },
    ball(4),
    { type: 'endInnings' },
    { type: 'openers', striker: id(m, 'Sam'), nonStriker: id(m, 'Jos') },
    { type: 'bowler', bowler: id(m, 'Rohit') },
    ball(chase),
    { type: 'endInnings' },
  ]);
}
const inSeries = (m: Match, number: number, of = 3): Match => ({ ...m, series: { id: 's1', name: 'Cup', of, number } });

test('a series: standings, the leader and the next match', () => {
  const s = seriesState([inSeries(quickGame(1, 1), 1), inSeries(quickGame(2, 6), 2)]);
  assert.equal(s.played, 2);
  assert.deepEqual(s.wins, [1, 1]);
  assert.equal(s.teams[0], 'Strikers');
  assert.equal(s.status, 'Series level 1–1');
  assert.equal(s.winner, null);
  assert.equal(s.next, 3);
  assert.ok(s.best, 'a man of the series so far');
});

test('a series is won as soon as it can’t be caught', () => {
  const s = seriesState([inSeries(quickGame(1, 1), 1), inSeries(quickGame(2, 1), 2)]);
  assert.equal(s.winner, 'Strikers');
  assert.equal(s.over, true);
  assert.equal(s.next, null);
  assert.equal(s.status, 'Strikers win the series 2–0');
  const five = seriesState([inSeries(quickGame(1, 6), 1, 5)]);
  assert.match(five.status, /lead 1–0/);
  assert.equal(five.next, 2);
});

test('a common player plays for both sides and is counted once', () => {
  const both = (m: Match) => {
    m.teams[0].players.push({ id: 'c-a', name: 'Joker', common: true });
    m.teams[1].players.push({ id: 'c-b', name: 'Joker', common: true });
    return m;
  };
  const m = both(
    game(9, (g) => [
      { type: 'openers', striker: 'c-a', nonStriker: id(g, 'Rohit') },
      { type: 'bowler', bowler: id(g, 'Sam') },
      ball(4),
    ]),
  );
  const joker = careerStats([m]).find((c) => c.name === 'Joker')!;
  assert.equal(joker.matches, 1);
  assert.equal(joker.team, 'Both teams');
  assert.equal(joker.batting.runs, 4);
});

test('a regular is one person whichever team they play for', () => {
  setRegulars(['Sam']);
  try {
    assert.equal(playerKey({ id: '', name: 'Royals', players: [] }, ' sam '), 'regular|sam');
    assert.equal(playerKey({ id: '', name: 'Team Sid', players: [] }, 'Sam'), 'regular|sam');
    assert.equal(playerKey({ id: '', name: 'Royals', players: [] }, 'Ben'), 'royals|ben');
    const sam = careerStats(twoGames()).find((c) => c.name === 'Sam')!;
    assert.equal(sam.key, 'regular|sam');
  } finally {
    setRegulars([]);
  }
});
