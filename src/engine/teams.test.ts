/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSeason } from '../demo/sampleSeason.ts';
import { DEFAULT_SQUAD } from './squad.ts';
import { setRegulars } from './stats.ts';
import { applyFix, evenSides, fillSides, gap, nameKey, rebalance, recentResults, sideStrength, strengthOf, strengths, type Strength } from './teams.ts';

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
  // A first name alone is that squad player, when only one has it; not when it could be several.
  assert.equal(strengthOf(table, 'Mahika').name, 'Mahika Kaushik');
  assert.equal(strengthOf(table, 'Singh').guest, true);
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

const names = (xs: Strength[]) => xs.map((p) => p.name);
const gapOf = (sides: [string[], string[]]) => gap(sides[0].map((n) => strengthOf(table, n)), sides[1].map((n) => strengthOf(table, n)));

test('after a player is sent across, the fix sends someone else back and leaves that player where they were put', () => {
  const split = evenSides(everyone, 2);
  const sides: [string[], string[]] = [names(split.sides[0]), names(split.sides[1])];
  // Move the strongest of the first side across: the second is now two bigger and stronger.
  const star = split.sides[0][0].name;
  const edited = applyFix(sides, { kind: 'move', player: star, to: 1 });
  assert.equal(edited[1].length - edited[0].length, 2);
  assert.equal(rebalance(sides, table), null, 'an even split needs no fix');
  const r = rebalance(edited, table, [star])!;
  assert.equal(r.fix.kind, 'move');
  assert.ok(r.fix.kind === 'move' && r.fix.to === 0 && r.fix.player !== star);
  const fixed = applyFix(edited, r.fix);
  assert.equal(fixed[0].length, fixed[1].length);
  assert.ok(gapOf(fixed) < gapOf(edited));
  assert.ok(fixed[1].includes(star));
});

test('after a lopsided swap, the fix is another swap that leaves the two swapped players alone', () => {
  const split = evenSides(everyone, 2);
  const sides: [string[], string[]] = [names(split.sides[0]), names(split.sides[1])];
  const strong = [...split.sides[0]].sort((a, b) => b.power - a.power)[0].name;
  const weak = [...split.sides[1]].sort((a, b) => a.power - b.power)[0].name;
  const edited = applyFix(sides, { kind: 'swap', players: [strong, weak] });
  const r = rebalance(edited, table, [strong, weak])!;
  assert.ok(r, 'a fix is offered');
  assert.equal(r.fix.kind, 'swap');
  assert.ok(r.fix.kind === 'swap' && !r.fix.players.includes(strong) && !r.fix.players.includes(weak));
  assert.ok(gapOf(applyFix(edited, r.fix)) < gapOf(edited));
});

test('a side’s recent results, newest first', () => {
  const res = recentResults(matches, 'Copan Strikers');
  const other = recentResults(matches, 'copan royals');
  assert.equal(res.length, 5);
  assert.ok(res.every((r) => r === 'W' || r === 'L' || r === 'T'));
  // The same games from the other side: each win one side's is the other's loss.
  assert.deepEqual(other.map((r) => (r === 'W' ? 'L' : r === 'L' ? 'W' : 'T')), res);
});
