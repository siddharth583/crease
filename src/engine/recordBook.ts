import { appIconSvg } from './mark.ts';
import { matchState, oversText } from './engine.ts';
import { headToHead, matchups, records, teamNames, verdict } from './records.ts';
import { REPORT_HEAD } from './report.ts';
import { battingAverage, bestFigures, bowlingOvers, careerStats, economy, playerOfTheMatch, strikeRate } from './stats.ts';
import type { Match } from './types.ts';

// The whole record book on paper: the season, every record, every player's career, every result and every
// rivalry. Same look as the match report (black cover, white cards), printed or saved as a PDF.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fixed = (n: number | null, d = 1) => (n === null ? '–' : n.toFixed(d));

type Line = { title: string; sub: string; value: string };

/** One record as a card: the holder first, then the chasers. */
function board(label: string, lines: Line[]): string {
  if (!lines.length) return '';
  const [first, ...rest] = lines;
  return `<div class="rb-board">
    <div class="label">${esc(label)}</div>
    <div class="holder"><div><div class="h-name">${esc(first.title)}</div><div class="h-sub">${esc(first.sub)}</div></div><div class="h-val">${esc(first.value)}</div></div>
    ${rest
      .map((l, i) => `<div class="b-row"><span class="b-rank">${i + 2}</span><div class="b-who"><b>${esc(l.title)}</b><span>${esc(l.sub)}</span></div><span class="b-val">${esc(l.value)}</span></div>`)
      .join('')}
  </div>`;
}

const section = (title: string, body: string) => (body.trim() ? `<section class="part"><h2>${esc(title)}</h2>${body}</section>` : '');

export function recordBookHtml(matches: Match[]): string {
  const finished = matches.filter((m) => matchState(m).result);
  const r = records(matches);
  const careers = careerStats(matches).sort((a, b) => b.batting.runs - a.batting.runs || b.bowling.wickets - a.bowling.wickets);
  const duels = matchups(matches)
    .filter((d) => d.balls >= 6)
    .sort((a, b) => b.balls - a.balls);
  const dates = matches.map((m) => m.createdAt).sort((a, b) => a - b);
  const span = dates.length ? (dates.length > 1 ? `${day(dates[0])} – ${day(dates[dates.length - 1])}` : day(dates[0])) : '';
  const teams = teamNames(matches);
  const s = r.summary;

  const cover = `<section class="cover">
    <div class="cover-top"><div class="brand"><span class="logo">${appIconSvg(24, { id: 'hm' })}</span>Crease</div><div class="cover-date">${esc(span)}</div></div>
    <div class="series">${esc(teams.slice(0, 4).join(' · '))}</div>
    <div class="rb-title">Record book</div>
    <div class="rb-cells">
      ${[
        ['Matches', s.matches],
        ['Runs', s.runs],
        ['Wickets', s.wickets],
        ['Sixes', s.sixes],
        ['Fours', s.fours],
        ['Fifties', s.fifties],
        ['Ducks', s.ducks],
        ['Overs', Math.round(s.balls / 6)],
      ]
        .map(([k, v]) => `<div><div class="rb-v">${v}</div><div class="rb-k">${k}</div></div>`)
        .join('')}
    </div>
    <div class="ghost">Records</div>
  </section>`;

  // Head to head for every pair of sides that has met.
  const pairs = teams.flatMap((a, i) => teams.slice(i + 1).map((b) => ({ a, b, ...headToHead(matches, a, b) }))).filter((h) => h.played > 0);
  const h2h = pairs
    .map(
      (h) => `<div class="h2h">
        <div class="h2h-side"><div class="h2h-w">${h.winsA}</div><div class="h2h-n">${esc(h.a)}</div><div class="h-sub">best ${h.bestA}</div></div>
        <div class="h2h-mid"><div class="h2h-p">${h.played}</div><div class="h-sub">played${h.ties ? ` · ${h.ties} tied` : ''}</div></div>
        <div class="h2h-side right"><div class="h2h-w b">${h.winsB}</div><div class="h2h-n">${esc(h.b)}</div><div class="h-sub">best ${h.bestB}</div></div>
      </div>`,
    )
    .join('');

  const batting = [
    board('Most runs', r.mostRuns.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub}`, value: String(x.count) }))),
    board('Highest scores', r.highScores.map((x) => ({ title: x.name, sub: `${x.balls} balls v ${x.vs} · ${day(x.date)}`, value: `${x.runs}${x.notOut ? '*' : ''}` }))),
    board('Fastest innings (15+ balls)', r.fastest.map((x) => ({ title: x.name, sub: `${x.runs} off ${x.balls} v ${x.vs}`, value: `${((x.runs * 100) / x.balls).toFixed(0)} SR` }))),
    board('Best strike rate (30+ balls)', r.bestStrikeRate.map((x) => ({ title: x.name, sub: x.sub, value: x.rate.toFixed(0) }))),
    board('Most sixes', r.mostSixes.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: String(x.count) }))),
    board('Most fours', r.mostFours.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: String(x.count) }))),
    board('Biggest partnerships', r.partnerships.map((x) => ({ title: x.names, sub: `${x.balls} balls · ${x.team} v ${x.vs}`, value: String(x.runs) }))),
    board('Most Man of the Match awards', r.mostMoM.map((x) => ({ title: x.name, sub: x.team, value: `${x.count}×` }))),
  ].join('');

  const bowling = [
    board('Most wickets', r.mostWickets.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub}`, value: String(x.count) }))),
    board('Best bowling', r.bestBowling.map((x) => ({ title: x.name, sub: `${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: `${x.wickets}/${x.runs}` }))),
    board('Best economy (6+ overs)', r.bestEconomy.map((x) => ({ title: x.name, sub: x.sub, value: x.rate.toFixed(2) }))),
    board('Catches, run-outs & stumpings', r.mostDismissals.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: String(x.count) }))),
  ].join('');

  const dearest = r.dearestOvers.length
    ? `<div class="rb-board wide"><div class="label">Most expensive overs</div>${r.dearestOvers
        .map(
          (o) => `<div class="b-row"><div class="b-who"><b>${esc(o.bowler)}</b><span>over ${o.over} to ${esc(o.batting)} · ${day(o.date)}</span></div><div class="balls">${o.balls
            .map((b) => `<i class="ball ${b.tone}">${esc(b.label)}</i>`)
            .join('')}</div><span class="b-val">${o.runs}</span></div>`,
        )
        .join('')}</div>`
    : '';

  const teamBoards = [
    board('Biggest wins by runs', r.biggestWinsByRuns.map((x) => ({ title: x.winner, sub: `beat ${x.loser} · ${day(x.date)}`, value: `${x.margin} runs` }))),
    board('Biggest wins by wickets', r.biggestWinsByWickets.map((x) => ({ title: x.winner, sub: `beat ${x.loser} · ${day(x.date)}`, value: `${x.margin} wkts` }))),
    board('Highest totals', r.highestTotals.map((x) => ({ title: x.team, sub: `${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: `${x.runs}/${x.wickets}` }))),
    board('Lowest totals', r.lowestTotals.map((x) => ({ title: x.team, sub: `${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: `${x.runs}/${x.wickets}` }))),
    board('Hall of shame: most ducks', r.mostDucks.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: `${x.count}×` }))),
  ].join('');

  const battingTable = `<div class="card flush"><table>
    <thead><tr><th class="name">Batting</th><th>M</th><th>Inn</th><th>NO</th><th>Runs</th><th>HS</th><th>Avg</th><th>SR</th><th>4s</th><th>6s</th><th>50s</th><th>0s</th></tr></thead>
    <tbody>${careers
      .filter((c) => c.batting.innings)
      .map(
        (c) => `<tr><td class="name"><div class="who">${esc(c.name)}</div><div class="how">${esc(c.team)}</div></td><td>${c.matches}</td><td>${c.batting.innings}</td><td>${c.batting.notOuts}</td><td class="runs"><b>${c.batting.runs}</b></td><td>${c.batting.highest}${c.batting.highestNotOut ? '*' : ''}</td><td>${fixed(battingAverage(c))}</td><td>${fixed(strikeRate(c), 0)}</td><td>${c.batting.fours}</td><td>${c.batting.sixes}</td><td>${c.batting.fifties}</td><td>${c.batting.ducks}</td></tr>`,
      )
      .join('')}</tbody></table></div>`;

  const bowlers = [...careers].filter((c) => c.bowling.balls).sort((a, b) => b.bowling.wickets - a.bowling.wickets || (economy(a) ?? 99) - (economy(b) ?? 99));
  const bowlingTable = `<div class="card flush"><table>
    <thead><tr><th class="name">Bowling & fielding</th><th>Inn</th><th>Overs</th><th>Runs</th><th>Wkts</th><th>Best</th><th>Avg</th><th>Econ</th><th>Ct</th><th>RO</th><th>St</th></tr></thead>
    <tbody>${bowlers
      .map(
        (c) => `<tr><td class="name"><div class="who">${esc(c.name)}</div><div class="how">${esc(c.team)}</div></td><td>${c.bowling.innings}</td><td>${bowlingOvers(c)}</td><td>${c.bowling.runs}</td><td class="runs"><b>${c.bowling.wickets}</b></td><td>${bestFigures(c)}</td><td>${c.bowling.wickets ? (c.bowling.runs / c.bowling.wickets).toFixed(1) : '–'}</td><td>${fixed(economy(c), 2)}</td><td>${c.fielding.catches}</td><td>${c.fielding.runOuts}</td><td>${c.fielding.stumpings}</td></tr>`,
      )
      .join('')}</tbody></table></div>`;

  const results = `<div class="card flush"><table>
    <thead><tr><th class="name">Date</th><th class="name">Match</th><th>First</th><th>Second</th><th class="name">Result</th><th class="name">Man of the match</th></tr></thead>
    <tbody>${[...finished]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((m) => {
        const st = matchState(m);
        const inn = st.innings.slice(0, 2).map((x) => `${esc(x.battingTeam.name)} ${x.runs}/${x.wickets} <span class="dim">(${oversText(x.legalBalls)})</span>`);
        const mom = playerOfTheMatch(m);
        return `<tr><td class="name dim">${day(m.createdAt)}</td><td class="name"><b>${esc(m.teams[0].name)} v ${esc(m.teams[1].name)}</b>${m.series ? `<div class="how">${esc(m.series.name)} · match ${m.series.number}</div>` : ''}</td><td>${inn[0] ?? ''}</td><td>${inn[1] ?? ''}</td><td class="name">${esc(st.result ?? '')}</td><td class="name">${mom ? esc(mom.name) : '–'}</td></tr>`;
      })
      .join('')}</tbody></table></div>`;

  const rivalries = duels.length
    ? `<div class="card flush"><table>
      <thead><tr><th class="name">Batter</th><th class="name">v Bowler</th><th>Balls</th><th>Runs</th><th>SR</th><th>Out</th><th>4s</th><th>6s</th><th class="name">Verdict</th></tr></thead>
      <tbody>${duels
        .map((d) => {
          const v = verdict(d);
          return `<tr><td class="name"><b>${esc(d.batter)}</b></td><td class="name">${esc(d.bowler)}</td><td>${d.balls}</td><td class="runs"><b>${d.runs}</b></td><td>${((d.runs * 100) / d.balls).toFixed(0)}</td><td>${d.outs}</td><td>${d.fours}</td><td>${d.sixes}</td><td class="name"><span class="verdict ${v.side}">${v.side === 'even' ? 'Even' : v.side === 'batter' ? 'Bat wins' : 'Ball wins'}</span></td></tr>`;
        })
        .join('')}</tbody></table></div>`
    : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Record book · Crease</title>
${REPORT_HEAD}
<style>
  .part { margin-top: 18px; }
  .part h2 { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 26px; margin: 0 2px 8px; break-after: avoid; }
  .rb-title { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 62px; line-height: .95; margin-top: 6px; position: relative; z-index: 1; }
  .rb-cells { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 8px; margin-top: 14px; position: relative; z-index: 1; }
  .rb-v { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 30px; line-height: 1; color: #F4F4EE; }
  .rb-k { font-size: 8px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; color: #9C9C94; margin-top: 2px; }
  .boards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .rb-board { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; break-inside: avoid; }
  .rb-board.wide { grid-column: 1 / -1; }
  .rb-board > .label { padding: 9px 12px 7px; }
  .holder { display: flex; align-items: center; gap: 10px; justify-content: space-between; background: #F3FBD6; padding: 9px 12px; }
  .h-name { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 18px; line-height: 1.05; }
  .h-sub { font-size: 9px; color: var(--muted); }
  .h-val { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 28px; line-height: 1; white-space: nowrap; }
  .b-row { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-top: 1px solid #F1F2EE; }
  .b-rank { width: 12px; color: var(--faint); font-weight: 800; }
  .b-who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .b-who b { font-size: 10.5px; }
  .b-who span { font-size: 8.5px; color: var(--muted); }
  .b-val { font-weight: 800; font-size: 12px; white-space: nowrap; }
  .balls { display: flex; gap: 3px; }
  .ball { font-style: normal; display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 3px; border-radius: 5px; font-size: 8.5px; font-weight: 800; background: var(--soft); color: #3A3D36; }
  .ball.four { background: #DDF3FA; color: #00728F; }
  .ball.six { background: var(--volt); color: #0A0A0A; }
  .ball.wicket { background: var(--red); color: #fff; }
  .ball.extra { background: #ECE8FB; color: #5B3FCB; }
  .h2h { display: flex; align-items: center; border: 1px solid var(--line); border-radius: 14px; padding: 12px 16px; margin-bottom: 8px; break-inside: avoid; }
  .h2h-side { flex: 1; }
  .h2h-side.right { text-align: right; }
  .h2h-mid { text-align: center; padding: 0 12px; }
  .h2h-w { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 44px; line-height: 1; color: var(--volt-ink); }
  .h2h-w.b { color: #5B3FCB; }
  .h2h-n { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 800; font-size: 16px; }
  .h2h-p { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 26px; color: var(--faint); }
  .part table th, .part table td { padding-left: 8px; padding-right: 8px; }
  .part th.name, .part td.name { width: auto; }
  .verdict { font-size: 8px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; border-radius: 5px; padding: 2px 6px; background: var(--soft); color: #3A3D36; }
  .verdict.batter { background: var(--volt); color: #0A0A0A; }
  .verdict.bowler { background: #7B61FF; color: #fff; }
</style></head>
<body><article>
  ${cover}
  ${section('Head to head', h2h)}
  ${section('Batting records', `<div class="boards">${batting}</div>`)}
  ${section('Bowling & fielding records', `<div class="boards">${bowling}${dearest}</div>`)}
  ${section('Team records', `<div class="boards">${teamBoards}</div>`)}
  ${section('Every player · batting', battingTable)}
  ${section('Every player · bowling & fielding', bowlers.length ? bowlingTable : '')}
  ${section('Rivalries · batter v bowler (6+ balls)', rivalries)}
  ${section('Every result', finished.length ? results : '')}
  <footer><span class="logo sm">${appIconSvg(15, { id: 'fm' })}</span> Scored ball by ball with Crease</footer>
</article></body></html>`;
}
