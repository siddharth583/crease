/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchState } from '../engine/engine.ts';
import { careerStats, playerOfTheMatch, seriesState } from '../engine/stats.ts';
import { sampleSeason } from './sampleSeason.ts';

const season = sampleSeason(new Date('2026-10-23T12:00:00Z'));

test('the Copan Cup: six of seven played, level 3–3, decider to come', () => {
  const s = seriesState(season.matches);
  assert.equal(s.name, 'Copan Cup');
  assert.deepEqual(s.wins, [3, 3]);
  assert.equal(s.next, 7);
  assert.ok(['Nihal Walia', 'Siddharth Singh'].includes(s.best!.name));
});

test('six finished matches, 10 overs, 8 a side, on Sundays', () => {
  assert.equal(season.matches.length, 6);
  for (const m of season.matches) {
    const st = matchState(m);
    assert.ok(st.result, `${m.id} has a result`);
    assert.equal(m.rules.overs, 10);
    assert.ok(m.teams.every((t) => t.players.length === 8));
    assert.equal(new Date(m.createdAt).getDay(), 0);
    for (const inn of st.innings) {
      assert.ok(inn.runs >= 30 && inn.runs <= 170, `${m.id}: ${inn.runs} is a believable 10-over total`);
      // Two bowlers may bowl 3 overs, everyone else 2 at most.
      for (const b of inn.bowlers) assert.ok(b.balls <= 18, `${b.id} bowled ${b.balls} balls`);
      assert.ok(inn.bowlers.filter((b) => b.balls > 12).length <= 2, 'at most two bowl a third over');
    }
  }
});

test('it is the same every time', () => {
  const again = sampleSeason(new Date('2026-10-23T12:00:00Z'));
  assert.deepEqual(
    again.matches.map((m) => matchState(m).result),
    season.matches.map((m) => matchState(m).result),
  );
});

test('the order inside each team follows the squad notes', () => {
  const careers = careerStats(season.matches);
  const team = (t: string) => careers.filter((c) => c.team === t);
  const top = (t: string, by: (c: (typeof careers)[number]) => number, n: number) =>
    [...team(t)].sort((a, b) => by(b) - by(a)).slice(0, n).map((c) => c.name);
  assert.deepEqual(top('Copan A', (c) => c.batting.runs, 2), ['Siddharth Singh', 'Anshul Rana']);
  assert.deepEqual(top('Copan B', (c) => c.batting.runs, 2), ['Nihal Walia', 'Ashwani Singh']);
  assert.equal(top('Copan A', (c) => c.bowling.wickets, 1)[0], 'Siddharth Singh');
  const nihal = team('Copan B').find((c) => c.name === 'Nihal Walia')!;
  assert.ok(nihal.history.filter((h) => h.bowl).length <= 2, 'Nihal keeps, so he rarely bowls');
  assert.ok(nihal.fielding.stumpings > 0, 'and he stumps people');
  const dismissals = (c: (typeof careers)[number]) => c.fielding.catches + c.fielding.runOuts + c.fielding.stumpings;
  assert.equal(top('Copan B', dismissals, 1)[0], 'Nihal Walia');
  assert.ok(season.matches.every((m) => playerOfTheMatch(m)));
});
