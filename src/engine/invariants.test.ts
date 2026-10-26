/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleSeason } from '../demo/sampleSeason.ts';
import { makeBackup, parseBackup } from './backup.ts';
import { addEvent, canUndo, matchState, newMatch, oversLeft, replaceBall, setOvers, startSuperOver, undo } from './engine.ts';
import { matchups, records, rivalry, verdict } from './records.ts';
import { recordBookHtml } from './recordBook.ts';
import { matchReportHtml } from './report.ts';
import { careerStats, playerOfTheMatch, seriesState } from './stats.ts';
import type { BallEvent, Match, WicketKind } from './types.ts';

// Plays many simulated seasons through the real engine and checks that every figure adds up, whichever way it
// is counted: scorecards, bowling figures, careers, records, rivalries, files and printed reports.

const SEASONS = 150;
const seasons = Array.from({ length: SEASONS }, (_, i) => sampleSeason(new Date('2026-10-25T12:00:00Z'), 1000 + i * 7919));

function checkMatch(m: Match) {
  const st = matchState(m);
  st.innings.forEach((s, i) => {
    if (!m.innings[i]?.events.length) return;
    const where = `${m.id} innings ${i + 1}`;
    const extras = s.extras.wide + s.extras.noball + s.extras.bye + s.extras.legbye + s.extras.penalty;
    const batRuns = s.batters.reduce((n, b) => n + b.runs, 0);
    assert.equal(s.runs, batRuns + extras, `${where}: total = batters + extras`);
    // The bowler is charged everything but byes, leg byes and penalties.
    const bowlRuns = s.bowlers.reduce((n, b) => n + b.runs, 0);
    assert.equal(bowlRuns, s.runs - s.extras.bye - s.extras.legbye - s.extras.penalty, `${where}: bowlers' runs`);
    assert.equal(s.bowlers.reduce((n, b) => n + b.balls, 0), s.legalBalls, `${where}: bowlers' balls`);
    assert.equal(s.batters.filter((b) => b.out && b.out.kind !== 'retired').length, s.wickets, `${where}: wickets = batters out`);
    assert.equal(s.fallOfWickets.length, s.wickets, `${where}: fall of wickets`);
    assert.ok(s.legalBalls <= s.maxBalls, `${where}: no more balls than the overs allow`);
    assert.equal(s.overTotals.reduce((n, o) => n + o.runs, 0), s.runs - s.extras.penalty, `${where}: runs per over`);
    assert.equal(s.overTotals.reduce((n, o) => n + o.wickets, 0), s.wickets, `${where}: wickets per over`);
    const bowlerWickets = s.bowlers.reduce((n, b) => n + b.wickets, 0);
    const notTheBowlers = s.batters.filter((b) => b.out && (b.out.kind === 'runout' || b.out.kind === 'retired')).length;
    assert.equal(bowlerWickets, s.wickets - s.batters.filter((b) => b.out?.kind === 'runout').length, `${where}: bowlers' wickets`);
    assert.ok(notTheBowlers >= 0);
    assert.equal(s.partnerships.reduce((n, p) => n + p.runs, 0), s.runs - s.extras.penalty, `${where}: partnerships`);
    for (const b of s.batters) assert.ok(b.fours * 4 + b.sixes * 6 <= b.runs, `${where}: boundaries within runs`);
    // Only when the side can bowl the innings under the limit (otherwise the app lifts it for the last overs).
    const room = (m.rules.maxOversPerBowler ?? 0) * s.bowlingTeam.players.length + Math.min(m.rules.extraOverBowlers ?? 0, s.bowlingTeam.players.length);
    if (m.rules.maxOversPerBowler && room * 6 >= s.maxBalls) {
      const limit = m.rules.maxOversPerBowler * 6;
      const over = s.bowlers.filter((b) => b.balls > limit);
      assert.ok(over.length <= (m.rules.extraOverBowlers ?? 0), `${where}: overs per bowler`);
      for (const b of over) assert.ok(b.balls <= limit + 6, `${where}: at most one extra over`);
    }
  });
  if (st.result) {
    const somebodyDidSomething = st.innings.some((s) => s.batters.some((b) => b.runs > 0) || s.wickets > 0);
    if (somebodyDidSomething) assert.ok(playerOfTheMatch(m), `${m.id}: a finished match has a Man of the Match`);
    // The deciding pair: the super over when there was one, else the match itself.
    const [a, b] = st.innings.length > 2 ? st.innings.slice(2) : st.innings;
    if (st.innings.length > 2) assert.equal(st.innings[1].runs, (st.innings[1].target ?? 0) - 1, `${m.id}: a super over only after a tie`);
    if (st.winner === a.battingTeam.id) assert.ok(a.runs > b.runs || (b.target !== null && b.runs < b.target), `${m.id}: the side batting first won`);
    if (st.winner === b.battingTeam.id) assert.ok(b.runs >= (b.target ?? Infinity) || b.runs > a.runs, `${m.id}: the chase got there`);
    if (!st.winner) assert.ok(/tied/i.test(st.result), `${m.id}: no winner means a tie`);
  }
}

test(`${SEASONS} simulated seasons: every scorecard adds up`, () => {
  let checked = 0;
  for (const { matches } of seasons)
    for (const m of matches) {
      checkMatch(m);
      checked += 1;
    }
  assert.equal(checked, SEASONS * 6);
});

test('undoing a whole match ball by ball never breaks a scorecard', () => {
  for (const { matches } of seasons.slice(0, 10)) {
    let m = matches[0];
    for (let i = 0; i < 400 && m.innings.some((x) => x.events.length); i++) {
      m = undo(m);
      checkMatch(m);
    }
  }
});

test('careers add up to the scorecards', () => {
  for (const { matches } of seasons.slice(0, 40)) {
    const careers = careerStats(matches);
    const inningsRuns = matches.flatMap((m) => matchState(m).innings.slice(0, 2)).reduce((n, s) => n + s.batters.reduce((k, b) => k + b.runs, 0), 0);
    assert.equal(careers.reduce((n, c) => n + c.batting.runs, 0), inningsRuns);
    const wickets = matches.flatMap((m) => matchState(m).innings.slice(0, 2)).reduce((n, s) => n + s.bowlers.reduce((k, b) => k + b.wickets, 0), 0);
    assert.equal(careers.reduce((n, c) => n + c.bowling.wickets, 0), wickets);
    for (const c of careers) assert.equal(c.history.length, c.matches);
  }
});

test('records, rivalries and verdicts hold for every season', () => {
  for (const { matches } of seasons.slice(0, 40)) {
    const r = records(matches);
    assert.equal(r.summary.matches, matches.filter((m) => matchState(m).result).length);
    for (const list of [r.mostRuns, r.mostWickets, r.mostSixes, r.mostFours]) for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].count >= list[i].count);
    for (let i = 1; i < r.bestEconomy.length; i++) assert.ok(r.bestEconomy[i - 1].rate <= r.bestEconomy[i].rate);
    for (const x of r.lowestTotals) assert.equal(x.wonChase, false);
    for (const d of matchups(matches).slice(0, 15)) {
      const v = verdict(d);
      assert.ok(v.edge > 0 && v.edge < 1 && v.title.length > 0);
      const full = rivalry(matches, d.batterKey, d.bowlerKey)!;
      assert.equal(full.meetings.reduce((n, x) => n + x.runs, 0), d.runs);
      assert.equal(full.dismissals.length, d.outs);
    }
  }
});

test('match files round-trip every season, and the series always has a state', () => {
  for (const { matches, teams } of seasons.slice(0, 40)) {
    const back = parseBackup(JSON.stringify(makeBackup(matches, teams)));
    assert.equal(back.matches.length, matches.length);
    assert.deepEqual(careerStats(back.matches), careerStats(matches));
    const s = seriesState(matches.filter((m) => m.series));
    assert.ok(s.played <= s.of);
  }
});

test('the printed reports build for every season, with nothing undefined in them', () => {
  for (const { matches } of seasons.slice(0, 20)) {
    for (const html of [matchReportHtml(matches, matches), recordBookHtml(matches)]) {
      assert.ok(html.startsWith('<!doctype html>'));
      assert.ok(!/undefined|NaN|\[object Object\]/.test(html), 'no undefined, NaN or objects in the report');
    }
  }
  // An empty phone still gets a record book.
  assert.ok(!/undefined|NaN/.test(recordBookHtml([])));
});

// ── Random matches under random house rules ──────────────────────────────────────────────────────────────────

/** Small seeded generator, so a failure can be replayed. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Played = { match: Match; steps: number; stuck: string | null; noBowler: number };

export function randomMatch(seed: number): Played {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const n = 2 + Math.floor(r() * 10);
  const team = (id: string) => ({ id, name: id.toUpperCase(), players: Array.from({ length: n }, (_, i) => ({ id: `${id}${i}`, name: `${id} player ${i + 1}x` })) });
  const teams: [ReturnType<typeof team>, ReturnType<typeof team>] = [team('a'), team('b')];
  const rules = {
    overs: 1 + Math.floor(r() * 5),
    playersPerSide: n,
    extraRun: r() < 0.7 ? 1 : 0,
    reball: r() < 0.7,
    lastManStands: r() < 0.3,
    maxOversPerBowler: r() < 0.5 ? 1 + Math.floor(r() * 2) : 0,
    extraOverBowlers: Math.floor(r() * 3),
    freeHit: r() < 0.5,
    bouncer: { fair: Math.floor(r() * 3), calledAs: r() < 0.5 ? ('wide' as const) : ('noball' as const) },
  };
  let m = newMatch(`fuzz-${seed}`, teams, rules, { winner: pick(['a', 'b']), choice: pick(['bat', 'bowl'] as const) });
  let noBowler = 0;
  for (let steps = 0; steps < 3000; steps++) {
    const st = matchState(m);
    if (st.result) {
      if (st.result === 'Match tied' && m.innings.length < 4 && r() < 0.8) {
        m = startSuperOver(m);
        continue;
      }
      return { match: m, steps, stuck: null, noBowler };
    }
    if (r() < 0.04 && canUndo(m)) {
      m = undo(m);
      continue;
    }
    const s = st.innings[st.current];
    const bowling = m.teams.find((t) => t.id === s.bowlingTeam.id)!;
    switch (s.status) {
      case 'openers': {
        const [x, y] = [...s.available].sort(() => r() - 0.5);
        if (!y) return { match: m, steps, stuck: `openers: only ${s.available.length} available`, noBowler };
        m = addEvent(m, { type: 'openers', striker: x, nonStriker: y });
        break;
      }
      case 'batter':
        if (!s.available.length) return { match: m, steps, stuck: 'batter: nobody available', noBowler };
        m = addEvent(m, { type: 'batter', batter: pick(s.available) });
        break;
      case 'bowler': {
        let can = bowling.players.filter((p) => p.id !== s.lastOverBowler && oversLeft(m, s, p.id) !== 0);
        if (!can.length) {
          noBowler += 1;
          can = bowling.players.filter((p) => p.id !== s.lastOverBowler);
        }
        if (!can.length) return { match: m, steps, stuck: 'bowler: nobody can bowl', noBowler };
        m = addEvent(m, { type: 'bowler', bowler: pick(can).id });
        break;
      }
      case 'live': {
        const roll = r();
        if (roll < 0.02) m = addEvent(m, { type: 'swap' });
        else if (roll < 0.03 && s.striker) m = addEvent(m, { type: 'retire', batter: s.striker });
        else if (roll < 0.035) m = addEvent(m, { type: 'penalty', runs: 5 });
        else if (roll < 0.04) m = addEvent(m, { type: 'deadBall' });
        else if (roll < 0.043) m = addEvent(m, { type: 'endInnings' });
        else if (roll < 0.048 && st.current < 2) m = setOvers(m, Math.max(1, m.rules.overs - 1), 40);
        else {
          const extra = pick([undefined, undefined, undefined, undefined, undefined, 'wide', 'noball', 'bye', 'legbye'] as const);
          const runs = extra === 'wide' ? pick([0, 0, 0, 1, 4]) : pick([0, 0, 1, 1, 1, 2, 2, 3, 4, 4, 6]);
          const ball: BallEvent = { type: 'ball', runs, ...(extra ? { extra } : {}) };
          if (r() < 0.05) ball.bouncer = pick([true, 'fair', 'wide'] as const);
          if (r() < 0.09 && s.striker) {
            const kinds: WicketKind[] = extra === 'wide' ? ['stumped', 'runout'] : extra === 'noball' ? ['runout'] : extra ? ['runout'] : ['bowled', 'caught', 'lbw', 'runout', 'stumped', 'hitwicket'];
            const kind = pick(kinds);
            const out = kind === 'runout' && s.nonStriker && r() < 0.4 ? s.nonStriker : s.striker;
            ball.wicket = { kind, playerOut: out, ...(['caught', 'runout', 'stumped'].includes(kind) ? { fielder: pick(bowling.players).id } : {}) };
            if (kind !== 'runout') ball.runs = 0;
          }
          m = addEvent(m, ball);
          // Now and then fix an earlier ball, as a scorer would.
          if (r() < 0.02) {
            const evs = m.innings[st.current].events;
            const at = evs.findIndex((e) => e.type === 'ball' && !e.wicket);
            if (at >= 0) m = replaceBall(m, st.current, at, { type: 'ball', runs: pick([0, 1, 2, 4]) });
          }
        }
        break;
      }
      case 'done':
        return { match: m, steps, stuck: `innings ${st.current + 1} is done but the match has no result`, noBowler };
    }
  }
  return { match: m, steps: 3000, stuck: 'did not finish in 3000 steps', noBowler };
}

test('3,000 random matches under random house rules: no crash, nothing stuck, every scorecard adds up', () => {
  const stuck: string[] = [];
  let noBowler = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const p = randomMatch(seed);
    noBowler += p.noBowler;
    if (p.stuck) stuck.push(`seed ${seed}: ${p.stuck}`);
    try {
      checkMatch(p.match);
    } catch (e) {
      throw new Error(`seed ${seed} (${JSON.stringify(p.match.rules)}): ${(e as Error).message}`);
    }
    assert.ok(!/undefined|NaN/.test(matchReportHtml([p.match])), `seed ${seed}: report`);
  }
  assert.deepEqual(stuck, []);
  // Bowling limits can leave nobody allowed to bowl in a short side; the app has to cope with that (see below).
  console.log(`overs where every bowler was out of overs: ${noBowler}`);
});
