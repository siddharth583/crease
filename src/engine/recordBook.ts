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

// The PDF is cut into pages wherever they fall, except through an `.avoid-break` block, so the page is built from
// blocks that never split: a pair of record cards, a head-to-head, a few rows of a table.

/** Record cards two by two, each pair on one row; an odd one out keeps its half. */
function pairs(boards: string[]): string[] {
  const shown = boards.filter(Boolean);
  const rows: string[] = [];
  for (let i = 0; i < shown.length; i += 2) rows.push(`<div class="pair avoid-break">${shown[i]}${shown[i + 1] ?? '<div class="rb-gap"></div>'}</div>`);
  return rows;
}

/** A table as blocks of rows with the same columns, so it reads as one table but breaks between rows. */
function table(cols: number[], head: string, rows: string[]): string[] {
  if (!rows.length) return [];
  const group = `<colgroup>${cols.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>`;
  const blocks = [`<table class="rb-table">${group}<thead><tr>${head}</tr></thead><tbody>${rows.slice(0, 3).join('')}</tbody></table>`];
  for (let i = 3; i < rows.length; i += 6) blocks.push(`<table class="rb-table">${group}<tbody>${rows.slice(i, i + 6).join('')}</tbody></table>`);
  return blocks.map((b) => `<div class="avoid-break">${b}</div>`);
}

/** A part of the book; its heading stays on the page with the first block under it. */
function section(title: string, blocks: string[]): string {
  const [first, ...rest] = blocks.filter(Boolean);
  if (!first) return '';
  return `<section class="part"><div class="avoid-break"><h2>${esc(title)}</h2>${first}</div>${rest.join('')}</section>`;
}

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
  </section>`;

  // Head to head for every pair of sides that has met.
  const meetings = teams.flatMap((a, i) => teams.slice(i + 1).map((b) => ({ a, b, ...headToHead(matches, a, b) }))).filter((h) => h.played > 0);
  const h2h = meetings.map((h) => {
    const lead = h.winsA === h.winsB ? `Level at ${h.winsA}–${h.winsB}` : h.winsA > h.winsB ? `${h.a} lead ${h.winsA}–${h.winsB}` : `${h.b} lead ${h.winsB}–${h.winsA}`;
    return `<div class="h2h avoid-break">
        <div class="h2h-side"><div class="h2h-w${h.winsA > h.winsB ? ' up' : ''}">${h.winsA}</div><div class="h2h-n">${esc(h.a)}</div><div class="h-sub">Best total ${h.bestA}</div></div>
        <div class="h2h-mid"><div class="h2h-lead">${esc(lead)}</div><div class="h-sub">${h.played} played${h.ties ? ` · ${h.ties} tied` : ''}</div></div>
        <div class="h2h-side right"><div class="h2h-w${h.winsB > h.winsA ? ' up' : ''}">${h.winsB}</div><div class="h2h-n">${esc(h.b)}</div><div class="h-sub">Best total ${h.bestB}</div></div>
      </div>`;
  });

  const batting = [
    board('Most runs', r.mostRuns.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub}`, value: String(x.count) }))),
    board('Highest scores', r.highScores.map((x) => ({ title: x.name, sub: `${x.balls} balls v ${x.vs} · ${day(x.date)}`, value: `${x.runs}${x.notOut ? '*' : ''}` }))),
    board('Best average (3+ innings)', r.bestAverage.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub}`, value: x.rate.toFixed(1) }))),
    board('Best strike rate (30+ balls)', r.bestStrikeRate.map((x) => ({ title: x.name, sub: x.sub, value: x.rate.toFixed(0) }))),
    board('Fastest innings (15+ balls)', r.fastest.map((x) => ({ title: x.name, sub: `${x.runs} off ${x.balls} v ${x.vs}`, value: `${((x.runs * 100) / x.balls).toFixed(0)} SR` }))),
    board('Biggest partnerships', r.partnerships.map((x) => ({ title: x.names, sub: `${x.balls} balls · ${x.team} v ${x.vs}`, value: String(x.runs) }))),
    board('Most sixes', r.mostSixes.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: String(x.count) }))),
    board('Most fours', r.mostFours.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: String(x.count) }))),
    board('Most Man of the Match awards', r.mostMoM.map((x) => ({ title: x.name, sub: x.team, value: `${x.count}×` }))),
  ];

  const bowling = [
    board('Most wickets', r.mostWickets.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub}`, value: String(x.count) }))),
    board('Best bowling', r.bestBowling.map((x) => ({ title: x.name, sub: `${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: `${x.wickets}/${x.runs}` }))),
    board('Best economy (6+ overs)', r.bestEconomy.map((x) => ({ title: x.name, sub: x.sub, value: x.rate.toFixed(2) }))),
    board('Most dot balls', r.mostDots.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: String(x.count) }))),
    board('Most fours conceded', r.mostFoursConceded.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: String(x.count) }))),
    board('Most sixes conceded', r.mostSixesConceded.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: String(x.count) }))),
    board('Most wides & no-balls', r.mostExtras.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: String(x.count) }))),
    board('Catches, run-outs & stumpings', r.mostDismissals.map((x) => ({ title: x.name, sub: `${x.team} · ${x.sub ?? ''}`, value: String(x.count) }))),
  ];

  const dearest = r.dearestOvers.length
    ? `<div class="rb-board avoid-break"><div class="label">Most expensive overs</div>${r.dearestOvers
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
    board('Hall of shame: most expensive spells', r.dearestSpells.map((x) => ({ title: x.name, sub: `${x.wickets}/${x.runs} off ${x.overs} overs v ${x.vs} · ${day(x.date)}`, value: `${x.runs} runs` }))),
  ];

  const nameCell = (name: string, team: string) => `<td class="name"><div class="who">${esc(name)}</div><div class="how">${esc(team)}</div></td>`;
  const heads = (labels: string[], left = 1) => labels.map((l, k) => `<th${k < left ? ' class="name"' : ''}>${esc(l)}</th>`).join('');

  const battingTable = table(
    [28, ...Array(11).fill(72 / 11)],
    heads(['Batter', 'M', 'Inn', 'NO', 'Runs', 'HS', 'Avg', 'SR', '4s', '6s', '50s', '0s']),
    careers
      .filter((c) => c.batting.innings)
      .map(
        (c) =>
          `<tr>${nameCell(c.name, c.team)}<td>${c.matches}</td><td>${c.batting.innings}</td><td>${c.batting.notOuts}</td><td class="runs"><b>${c.batting.runs}</b></td><td>${c.batting.highest}${c.batting.highestNotOut ? '*' : ''}</td><td>${fixed(battingAverage(c))}</td><td>${fixed(strikeRate(c), 0)}</td><td>${c.batting.fours}</td><td>${c.batting.sixes}</td><td>${c.batting.fifties}</td><td>${c.batting.ducks}</td></tr>`,
      ),
  );

  const bowlers = [...careers].filter((c) => c.bowling.balls).sort((a, b) => b.bowling.wickets - a.bowling.wickets || (economy(a) ?? 99) - (economy(b) ?? 99));
  const bowlingTable = table(
    [28, ...Array(10).fill(7.2)],
    heads(['Bowler', 'Inn', 'Overs', 'Runs', 'Wkts', 'Best', 'Avg', 'Econ', 'Ct', 'RO', 'St']),
    bowlers.map(
      (c) =>
        `<tr>${nameCell(c.name, c.team)}<td>${c.bowling.innings}</td><td>${bowlingOvers(c)}</td><td>${c.bowling.runs}</td><td class="runs"><b>${c.bowling.wickets}</b></td><td>${bestFigures(c)}</td><td>${c.bowling.wickets ? (c.bowling.runs / c.bowling.wickets).toFixed(1) : '–'}</td><td>${fixed(economy(c), 2)}</td><td>${c.fielding.catches}</td><td>${c.fielding.runOuts}</td><td>${c.fielding.stumpings}</td></tr>`,
    ),
  );

  const results = table(
    [13, 21, 21, 27, 18],
    heads(['Date', 'First innings', 'Second innings', 'Result', 'Man of the Match'], 5),
    [...finished]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((m) => {
        const st = matchState(m);
        const inn = st.innings
          .slice(0, 2)
          .map((x) => `<td class="name"><div class="who">${x.runs}/${x.wickets} <span class="dim">(${oversText(x.legalBalls)})</span></div><div class="how">${esc(x.battingTeam.name)}</div></td>`);
        const mom = playerOfTheMatch(m);
        const series = m.series ? `<div class="how">${esc(m.series.name)} · match ${m.series.number}</div>` : '';
        return `<tr><td class="name"><div class="who">${day(m.createdAt)}</div></td>${inn.join('')}<td class="name"><div class="who"><b>${esc(st.result ?? '')}</b></div>${series}</td><td class="name">${mom ? esc(mom.name) : '–'}</td></tr>`;
      }),
  );

  const rivalries = table(
    [21, 21, 8, 8, 8, 7, 6, 6, 15],
    heads(['Batter', 'Bowler', 'Balls', 'Runs', 'SR', 'Out', '4s', '6s', 'Verdict'], 2),
    duels.map((d) => {
      const v = verdict(d);
      return `<tr><td class="name"><b>${esc(d.batter)}</b></td><td class="name">${esc(d.bowler)}</td><td>${d.balls}</td><td class="runs"><b>${d.runs}</b></td><td>${((d.runs * 100) / d.balls).toFixed(0)}</td><td>${d.outs}</td><td>${d.fours}</td><td>${d.sixes}</td><td><span class="verdict ${v.side}">${v.side === 'even' ? 'Even' : v.side === 'batter' ? 'Bat wins' : 'Ball wins'}</span></td></tr>`;
    }),
  );

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Record book · Crease</title>
${REPORT_HEAD}
<style>
  .part { margin-top: 22px; }
  .part h2 { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 21px; line-height: 1.1; margin: 0 2px 10px; padding-bottom: 6px; border-bottom: 2px solid var(--ink); }
  .rb-title { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 62px; line-height: .95; margin-top: 6px; position: relative; z-index: 1; }
  .rb-cells { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 8px; margin-top: 14px; position: relative; z-index: 1; }
  .rb-v { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 30px; line-height: 1; color: #F4F4EE; }
  .rb-k { font-size: 8px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; color: #9C9C94; margin-top: 2px; }
  .pair { display: flex; gap: 10px; align-items: stretch; margin-bottom: 10px; }
  .pair > * { flex: 1; min-width: 0; }
  .part > .avoid-break > .rb-board, .part > .rb-board { margin-bottom: 10px; }
  .rb-board { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; break-inside: avoid; }
  .rb-board > .label { padding: 9px 12px 7px; }
  .holder { display: flex; align-items: center; gap: 10px; justify-content: space-between; background: #F3FBD6; padding: 9px 12px; }
  .h-name { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 16px; line-height: 1.1; }
  .h-sub { font-size: 9px; color: var(--muted); }
  .h-val { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 24px; line-height: 1; white-space: nowrap; }
  .b-row { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-top: 1px solid #F1F2EE; }
  .b-rank { width: 12px; color: var(--faint); font-weight: 800; }
  .b-who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .b-who b { font-size: 10.5px; font-weight: 600; }
  .b-who span { font-size: 8.5px; color: var(--muted); }
  .b-val { font-weight: 800; font-size: 12px; white-space: nowrap; }
  .balls { display: flex; gap: 3px; }
  .ball { font-style: normal; display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 3px; border-radius: 5px; font-size: 8.5px; font-weight: 800; background: var(--soft); color: #3A3D36; }
  .ball.four { background: #DDF3FA; color: #00728F; }
  .ball.six { background: var(--volt); color: #0A0A0A; }
  .ball.wicket { background: var(--red); color: #fff; }
  .ball.extra { background: #ECE8FB; color: #5B3FCB; }
  .h2h { display: flex; align-items: center; border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px; margin-bottom: 10px; break-inside: avoid; }
  .h2h-side { flex: 1; }
  .h2h-side.right { text-align: right; }
  .h2h-mid { text-align: center; padding: 0 12px; }
  .h2h-w { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 40px; line-height: 1; color: var(--faint); }
  .h2h-w.up { color: var(--volt-ink); }
  .h2h-n { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 800; font-size: 16px; }
  .h2h-lead { display: inline-block; background: var(--volt); color: #0A0A0A; font-weight: 800; font-size: 10.5px; border-radius: 99px; padding: 3px 10px; margin-bottom: 3px; white-space: nowrap; }
  .rb-table { table-layout: fixed; }
  .rb-table th, .rb-table td { padding: 5px 6px; }
  .rb-table th { padding-top: 7px; background: var(--soft); border-bottom: 0; }
  .rb-table th:first-child { border-radius: 8px 0 0 8px; }
  .rb-table th:last-child { border-radius: 0 8px 8px 0; }
  .rb-table tbody tr:last-child td { border-bottom: 1px solid #F1F2EE; }
  .rb-table th.name, .rb-table td.name { width: auto; }
  /* html2canvas measures tabular figures wrongly and leaves gaps ("102 /2"), so the book uses plain ones. */
  .rb-table td, .b-val, .h-val { font-variant-numeric: normal; overflow: hidden; text-overflow: ellipsis; }
  .h-val { overflow: visible; }
  .rb-table .who { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 10.5px; }
  .rb-table .how { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rb-table td.name b { font-weight: 600; }
  .rb-table td.runs { width: auto; }

  .verdict { font-size: 8px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; border-radius: 5px; padding: 2px 6px; background: var(--soft); color: #3A3D36; }
  .verdict.batter { background: var(--volt); color: #0A0A0A; }
  .verdict.bowler { background: #7B61FF; color: #fff; }
</style></head>
<body><article>
  ${cover}
  ${section('Head to head', h2h)}
  ${section('Batting records', pairs(batting))}
  ${section('Bowling & fielding records', [...pairs(bowling), dearest])}
  ${section('Team records', pairs(teamBoards))}
  ${section('Every player · batting', battingTable)}
  ${section('Every player · bowling & fielding', bowlingTable)}
  ${section('Rivalries · batter v bowler (6+ balls)', rivalries)}
  ${section('Every result', results)}
  <footer><span class="logo sm">${appIconSvg(15, { id: 'fm' })}</span> Scored ball by ball with Crease</footer>
</article></body></html>`;
}
