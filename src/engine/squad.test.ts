/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newMatch } from './engine.ts';
import { renameSides, renameTeam } from './squad.ts';
import type { Team } from './types.ts';

const side = (id: string, name: string): Team => ({ id, name, players: [{ id: `${id}1`, name: 'One' }, { id: `${id}2`, name: 'Two' }] });

test('Copan A and B take their new names, in the teams and the series', () => {
  const m = newMatch('m', [side('a', 'Copan A'), side('b', 'copan b')], { overs: 5, playersPerSide: 2 } as never, { winner: 'a', choice: 'bat' });
  m.series = { id: 's', name: 'Copan A vs Copan B', of: 3, number: 1 };
  const r = renameSides(m);
  assert.deepEqual(r.teams.map((t) => t.name), ['Copan Strikers', 'Copan Royals']);
  assert.equal(r.series?.name, 'Copan Strikers vs Copan Royals');
  assert.equal(r.innings[0].battingTeam, 'a');
});

test('other names are left alone, and the same object comes back', () => {
  const t = side('x', 'Copan Cup Babies');
  assert.equal(renameTeam(t), t);
  assert.equal(renameTeam(side('y', 'Copan Australia')).name, 'Copan Australia');
  const m = newMatch('m', [side('a', 'Strikers'), side('b', 'Royals')], { overs: 5, playersPerSide: 2 } as never, { winner: 'a', choice: 'bat' });
  assert.equal(renameSides(m), m);
});
