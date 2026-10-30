/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSeason } from '../demo/sampleSeason.ts';
import { DEFAULT_SQUAD } from './squad.ts';
import { setRegulars } from './stats.ts';
import { evenSides, fillSides, nameKey, sideStrength, strengthOf, strengths, type Strength } from './teams.ts';

// As the app does at start-up: the squad's names are the same people whichever side they play for.
setRegulars(DEFAULT_SQUAD.map((p) => p.name));
const { matches } = sampleSeason(new Date('2026-10-23T12:00:00Z'));
const table = strengths(matches, DEFAULT_SQUAD);
const everyone = [...table.values()];

test('a player’s strength leans on form, and a newcomer plays to their stars', () => {
  const played = everyone.filter((p) => p.form !== null);
  const fresh = everyone.filter((p) => p.form === null);
  assert.ok(played.length > 0 && fresh.length > 0);
  for (const p of everyone) assert.ok(p.power >= 1 && p.power <= 10, `${p.name}: ${p.power}`);
  // Mahika joined after the sample season: three stars all round make a 6.
  assert.equal(strengthOf(table, 'mahika kaushik ').power, 6);
  assert.equal(strengthOf(table, 'Someone New').guest, true);
});

test('two even sides from everyone, a keeper each, and Shuffle gives another fair pair', () => {
  const first = evenSides(everyone, 1);
  const [a, b] = first.sides;
  assert.equal(a.length + b.length, everyone.length);
  assert.ok(Math.abs(a.length - b.length) <= 1);
  assert.ok(first.gap <= 1, `sides ${first.gap} apart`);
  assert.ok(a.some((p) => p.keeper) && b.some((p) => p.keeper), 'a keeper each');
  const seen = new Set(Array.from({ length: 6 }, (_, i) => evenSides(everyone, i + 1).sides[0].map((p) => p.name).sort().join()));
  assert.ok(seen.size > 1, 'shuffles differ');
  for (let s = 1; s <= 6; s++) assert.ok(evenSides(everyone, s).gap <= 1.3);
});

test('captains lead opposite sides', () => {
  const split = evenSides(everyone, 3, ['Nihal Walia', 'Ashwani Singh']);
  assert.equal(split.sides[0][0].name, 'Nihal Walia');
  assert.equal(split.sides[1][0].name, 'Ashwani Singh');
});

test('filling the sides: the weaker side takes the best player left', () => {
  const strong = ['Siddharth Singh', 'Nihal Walia'];
  const weak = ['Rajeev', 'Satnoor Singh'];
  const [toStrong, toWeak] = fillSides([strong, weak], 3, everyone, table);
  assert.equal(toStrong.length, 1);
  assert.equal(toWeak.length, 1);
  const best = everyone.filter((p) => ![...strong, ...weak].includes(p.name)).sort((x, y) => y.power - x.power)[0];
  assert.equal(toWeak[0], best.name);
  // Nobody is added twice, and a full side takes no one.
  assert.deepEqual(fillSides([['A', 'B'], ['C']], 2, [{ name: 'D', power: 5, form: null, bat: 3, bowl: 3, keeper: false } as Strength], table), [[], ['D']]);
  assert.deepEqual(fillSides([[...strong], [...weak]], 2, everyone, table), [[], []]);
  assert.equal(nameKey(' Rajeev '), 'rajeev');
});

test('a side’s strength sums up its players', () => {
  const s = sideStrength(['Siddharth Singh', 'Rajeev'].map((n) => strengthOf(table, n)));
  assert.equal(s.players[0].name, 'Siddharth Singh');
  assert.ok(s.power > 0 && s.bat >= 1 && s.bowl >= 1);
});
