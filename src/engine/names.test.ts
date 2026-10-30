/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { knownNames, suggestNames } from './names.ts';

const known = ['Mahika Kaushik', 'Anshul Rana', 'Ashwani Singh', 'Siddharth Singh', 'Charanjeet', 'Rajeev'];

test('typing a first name suggests the known player', () => {
  assert.deepEqual(suggestNames('Mahika', known), ['Mahika Kaushik']);
  assert.deepEqual(suggestNames('mah', known), ['Mahika Kaushik']);
  // A surname finds them too, those starting with it first.
  assert.deepEqual(suggestNames('singh', known), ['Ashwani Singh', 'Siddharth Singh']);
  assert.deepEqual(suggestNames('rana', known), ['Anshul Rana']);
});

test('a near miss is caught, a stray letter isn’t enough', () => {
  assert.deepEqual(suggestNames('Ashwni', known), ['Ashwani Singh']);
  assert.deepEqual(suggestNames('Rajiv', known), []);
  assert.deepEqual(suggestNames('a', known), [], 'one letter is too few');
});

test('nothing for a name already spelt right, the right spelling for a wrong case, never a taken name', () => {
  assert.deepEqual(suggestNames('Rajeev', known), []);
  assert.deepEqual(suggestNames('rajeev', known), ['Rajeev']);
  assert.deepEqual(suggestNames('si', known, ['Siddharth Singh']), ['Ashwani Singh']);
  assert.deepEqual(suggestNames('Somebody New', known), []);
});

test('known names: the squad first, then others by how often they play, each once', () => {
  const names = knownNames(['Rajeev'], [['Rajeev', 'Guest One', 'Player 3'], ['guest one', 'Another'], ['Guest One ', 'rajeev']]);
  assert.deepEqual(names, ['Rajeev', 'Guest One', 'Another']);
  // A first name alone is the squad player who has it, so it isn't offered as somebody else.
  assert.deepEqual(knownNames(['Mahika Kaushik'], [['Mahika', 'Vivek']]), ['Mahika Kaushik', 'Vivek']);
});
