import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auctionState, canBid, money, moneyShort, newAuction, nextBid, passPlayer, sell, undoAuction, type Auction } from './auction.ts';
import { DEFAULT_SQUAD } from './squad.ts';

const noShuffle = () => 0.999;

function eightPlayers(): Auction {
  const roster = DEFAULT_SQUAD.slice(0, 8);
  return newAuction('a1', roster, [
    { name: 'Team Sid', captain: roster[0].id },
    { name: 'Team Anshul', captain: roster[1].id },
  ], { purse: 30, base: 5, step: 1 }, noShuffle);
}

test('captains lead their side and are not auctioned', () => {
  const a = eightPlayers();
  const s = auctionState(a);
  assert.equal(s.queue.length, 6);
  assert.equal(s.sideSize, 4);
  assert.deepEqual(s.sides[0].players, [a.sides[0].captain]);
  assert.equal(s.sides[0].slots, 3);
  // 30 points, three places: keep 5 each for the last two.
  assert.equal(s.sides[0].maxBid, 20);
});

test('selling spends the purse and caps the next bid', () => {
  let a = eightPlayers();
  const first = auctionState(a).current!;
  a = sell(a, 0, 18);
  const s = auctionState(a);
  assert.equal(s.sides[0].left, 12);
  assert.deepEqual(s.sides[0].players.slice(1), [first]);
  assert.equal(s.sides[0].maxBid, 7);
  assert.equal(canBid(a, 0, 8), false);
  assert.throws(() => sell(a, 0, 8));
  assert.equal(nextBid(a, null), 5);
  assert.equal(nextBid(a, 7), 8);
});

test('an unsold player comes back once, then has to be taken', () => {
  let a = eightPlayers();
  const first = auctionState(a).current!;
  a = passPlayer(a);
  let s = auctionState(a);
  assert.notEqual(s.current, first);
  assert.equal(s.queue[s.queue.length - 1], first);
  a = passPlayer(a);
  for (let i = 0; i < 4; i++) a = sell(a, (i % 2) as 0 | 1, 5);
  s = auctionState(a);
  assert.equal(s.current, first);
  assert.equal(s.lastCall, true);
  assert.throws(() => passPlayer(a));
});

test('when one side is full the rest join the other at the base price', () => {
  let a = eightPlayers();
  for (let i = 0; i < 3; i++) a = sell(a, 0, 6);
  const s = auctionState(a);
  assert.equal(s.done, true);
  assert.equal(s.sides[0].players.length, 4);
  assert.equal(s.sides[1].players.length, 4);
  assert.ok(s.sides[1].bought.every((p) => p.auto && p.price === 5));
});

test('undo takes back the last sale', () => {
  let a = eightPlayers();
  const first = auctionState(a).current!;
  a = undoAuction(sell(a, 1, 9));
  assert.equal(auctionState(a).current, first);
  assert.equal(auctionState(a).sides[1].left, 30);
});

test('an odd number of players: one side ends a player short', () => {
  const roster = DEFAULT_SQUAD.slice(0, 7);
  let a = newAuction('a2', roster, [
    { name: 'A', captain: roster[0].id },
    { name: 'B', captain: roster[1].id },
  ], { purse: 30, base: 5, step: 1 }, noShuffle);
  while (!auctionState(a).done) a = sell(a, 0, 5);
  const s = auctionState(a);
  assert.deepEqual([s.sides[0].players.length, s.sides[1].players.length], [4, 3]);
});

test('rupees are written the Indian way', () => {
  assert.equal(money(100_000), '₹1,00,000');
  assert.equal(money(12_500), '₹12,500');
  assert.equal(money(950), '₹950');
  assert.equal(money(2_50_00_000), '₹2,50,00,000');
  assert.equal(moneyShort(100_000), '₹1L');
  assert.equal(moneyShort(250_000), '₹2.5L');
  assert.equal(moneyShort(5_000), '₹5K');
});
