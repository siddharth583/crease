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

test('a pasted list of emails links each to its squad player, whatever its shape, and new names join', async () => {
  const { DEFAULT_SQUAD, linkEmails, playerForEmail } = await import('./squad.ts');
  // Made-up addresses, laid out the ways a list arrives: "email - name", "name - email", the name on the line above.
  const text = `1. nihal@example.com - Nihal Walia
2. Anshul Rana - anshul@example.com
3. mo.w@example.com- Moses William
4.
Nitin Parmar
nitin@example.com
5. Saurav Sirswal - saurav@example.com
6. mahika@example.com - Mahika
Charanjeet and Rajeev don't have any email`;
  let n = 0;
  const { squad, linked, added } = linkEmails(DEFAULT_SQUAD, text, () => `new-${++n}`);
  assert.equal(playerForEmail(squad, 'NIHAL@example.com ')?.name, 'Nihal Walia');
  assert.equal(playerForEmail(squad, 'anshul@example.com')?.name, 'Anshul Rana');
  assert.equal(playerForEmail(squad, 'mo.w@example.com')?.name, 'Moses Wiliams', 'the squad’s spelling kept');
  assert.equal(playerForEmail(squad, 'nitin@example.com')?.name, 'Nitin Parmar');
  assert.equal(playerForEmail(squad, 'mahika@example.com')?.name, 'Mahika Kaushik', 'a first name alone');
  assert.deepEqual(added, ['Saurav Sirswal']);
  assert.equal(squad.find((p) => p.name === 'Saurav Sirswal')?.bat, 3);
  assert.equal(linked.length, 5);
  assert.equal(squad.find((p) => p.name === 'Charanjeet')?.email, undefined);
  // Pasting it again links the same and adds nobody.
  assert.equal(linkEmails(squad, text, () => 'x').added.length, 0);
});
