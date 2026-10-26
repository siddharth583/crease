/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupFileName, makeBackup, mergeMatches, parseBackup } from './backup.ts';
import { addEvent, newMatch } from './engine.ts';
import { careerStats } from './stats.ts';
import type { InningsEvent, Match, Team } from './types.ts';

const team = (id: string, names: string[]): Team => ({
  id,
  name: id === 'a' ? 'Strikers' : 'Royals',
  players: names.map((n) => ({ id: `${id}-${n}`, name: n })),
});
const rules = { overs: 2, playersPerSide: 3, extraRun: 1, reball: true, lastManStands: false };

function match(id: string, createdAt: number, events: InningsEvent[]): Match {
  const m = newMatch(id, [team('a', ['Rohit', 'Virat', 'Surya']), team('b', ['Sam', 'Jos', 'Ben'])], rules, {
    winner: 'a',
    choice: 'bat',
  });
  m.createdAt = createdAt;
  return events.reduce(addEvent, m);
}

const opening: InningsEvent[] = [
  { type: 'openers', striker: 'a-Rohit', nonStriker: 'a-Virat' },
  { type: 'bowler', bowler: 'b-Sam' },
];
const four: InningsEvent = { type: 'ball', runs: 4 };

test('a match file round-trips and carries the player stats with it', () => {
  const m = match('m1', 1, [...opening, four, four]);
  const text = JSON.stringify(makeBackup([m], m.teams));
  const back = parseBackup(text);
  assert.equal(back.matches.length, 1);
  assert.equal(back.teams.length, 2);
  assert.equal(back.skipped, 0);
  const rohit = careerStats(back.matches).find((c) => c.name === 'Rohit Kumar')!;
  assert.equal(rohit.batting.runs, 8);
});

test('rejects files that aren’t Crease match files', () => {
  assert.throws(() => parseBackup('not json'), /isn’t a Crease match file/);
  assert.throws(() => parseBackup('{"hello":1}'), /isn’t a Crease match file/);
  assert.throws(() => parseBackup('{"app":"crease","version":99,"matches":[]}'), /newer version/);
});

test('skips broken matches but keeps the good ones', () => {
  const good = match('m1', 1, opening);
  const back = parseBackup(JSON.stringify({ app: 'crease', version: 1, matches: [good, { id: 'x' }], teams: [] }));
  assert.equal(back.matches.length, 1);
  assert.equal(back.skipped, 1);
});

test('importing adds new matches, moves matches forward, never back, and is safe to repeat', () => {
  const early = match('m1', 1, [...opening, four]);
  const later = match('m1', 1, [...opening, four, four, four]);
  const other = match('m2', 2, opening);

  const first = mergeMatches([early], [later, other]);
  assert.deepEqual([first.added, first.updated, first.unchanged], [1, 1, 0]);
  assert.deepEqual(first.matches.map((m) => m.id), ['m2', 'm1'], 'newest first');

  const stale = mergeMatches(first.matches, [early]);
  assert.deepEqual([stale.added, stale.updated, stale.unchanged], [0, 0, 1]);
  assert.equal(stale.matches.find((m) => m.id === 'm1'), later);

  const again = mergeMatches(first.matches, [later, other]);
  assert.equal(again.changed.length, 0);
});

test('file names say what is inside', () => {
  const m = match('m1', 1, opening);
  const day = new Date('2026-10-23T10:00:00Z');
  const played = { ...m, createdAt: new Date(2026, 9, 21, 18).getTime() };
  assert.equal(backupFileName([played], day), 'Strikers vs Royals - 21 Oct 2026.json', 'the day it was played');
  assert.equal(backupFileName([m, m], day), 'Crease - 2 matches - 23 Oct 2026.json');
  assert.equal(backupFileName([played], day, 'pdf'), 'Strikers vs Royals - 21 Oct 2026.pdf');
  const series = { ...played, series: { id: 's', name: 'Copan Cup', of: 5, number: 3 } };
  assert.equal(backupFileName([series], day), 'Copan Cup - Match 3 - Strikers vs Royals - 21 Oct 2026.json');
  assert.equal(backupFileName([series, series], day), 'Copan Cup - 2 matches - 23 Oct 2026.json');
  const odd = { ...played, teams: [{ ...played.teams[0], name: 'A/B: "XI"' }, played.teams[1]] as Match['teams'] };
  assert.equal(backupFileName([odd], day), 'A B XI vs Royals - 21 Oct 2026.json', 'no characters a file name can’t hold');
});

test('the printable report has a page per match, with names escaped', async () => {
  const { matchReportHtml } = await import('./report.ts');
  const m = match('m1', 1, [...opening, four]);
  m.teams[0].name = 'Strikers <A>';
  const html = matchReportHtml([m, match('m2', 2, opening)]);
  assert.equal(html.match(/<article class="match">/g)?.length, 2);
  assert.ok(html.includes('Strikers &lt;A&gt;'));
  assert.ok(!html.includes('Strikers <A>'));
  assert.ok(html.includes('Rohit'));
});
