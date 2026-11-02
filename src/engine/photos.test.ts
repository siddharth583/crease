/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhotos, photoFor, photoKey } from './photos.ts';

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

test('a photo follows the player by full name, any case, and an old short name', () => {
  assert.equal(photoKey('  Nihal   Walia '), 'nihal walia');
  assert.equal(photoKey('Ajayvir'), 'ajayvir singh ghai');
  assert.equal(photoFor({ 'ajayvir singh ghai': JPEG }, 'Ajayvir'), JPEG);
  assert.equal(photoFor({}, 'Nihal Walia'), undefined);
});

test('a photos file keeps only pictures, and anything else is not a photos file', () => {
  const file = JSON.stringify({ crease: 'photos', photos: { 'Nihal Walia': JPEG, Bad: 'https://example.com/x.jpg', Script: 'javascript:alert(1)' } });
  assert.deepEqual(parsePhotos(file), { 'nihal walia': JPEG });
  assert.equal(parsePhotos(JSON.stringify({ crease: 'backup' })), null);
  assert.equal(parsePhotos('not json'), null);
});
