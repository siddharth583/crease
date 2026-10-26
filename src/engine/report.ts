import { appIconSvg } from './mark.ts';
import { dismissal, matchState, oversText, playerName, type InningsState, type MatchState } from './engine.ts';
import { playerOfTheMatch, seriesState } from './stats.ts';
import type { Match } from './types.ts';

// A printable match report, like a matchday programme: a black scoreboard cover with both totals, the
// highlights on cards, the run race, then each innings as a clean scorecard on white. Turned into a PDF on
// the phone, or made into a PDF file in the browser.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const sr = (r: number, b: number) => (b ? ((r * 100) / b).toFixed(1) : '–');
const econ = (r: number, b: number) => (b ? ((r * 6) / b).toFixed(2) : '–');
const rate = (r: number, b: number) => (b ? ((r * 6) / b).toFixed(2) : '0.00');

const INNINGS_TINT = ['#B5E000', '#7B61FF'];

/** The innings that were actually played, with their label. */
function playedInnings(match: Match, state: MatchState) {
  return state.innings
    .map((s, i) => ({ s, i, label: i >= 2 ? 'Super over' : i === 0 ? '1st innings' : '2nd innings' }))
    .filter(({ i }) => match.innings[i]?.events.length > 0);
}

function highlights(match: Match, state: MatchState) {
  const main = state.innings.slice(0, 2);
  const bat = main
    .flatMap((s) => s.batters.map((b) => ({ ...b, team: s.battingTeam.name })))
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0];
  const bowl = main
    .flatMap((s) => s.bowlers.map((b) => ({ ...b, team: s.bowlingTeam.name })))
    .filter((b) => b.balls)
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
  const fours = main.reduce((n, s) => n + s.batters.reduce((m, b) => m + b.fours, 0), 0);
  const sixes = main.reduce((n, s) => n + s.batters.reduce((m, b) => m + b.sixes, 0), 0);
  const bigOver = main
    .flatMap((s) => s.overTotals.map((o, i) => ({ runs: o.runs, over: i + 1, team: s.battingTeam.name })))
    .sort((a, b) => b.runs - a.runs)[0];
  const potm = playerOfTheMatch(match);
  const tiles: string[] = [];
  if (potm)
    tiles.push(`<div class="tile mom"><div class="tile-k">Man of the match</div><div class="tile-v">${esc(potm.name)}</div><div class="tile-s">${esc(potm.summary)}</div></div>`);
  if (bat && bat.balls)
    tiles.push(
      `<div class="tile"><div class="tile-k">Top score</div><div class="tile-n">${bat.runs}<small>${bat.out || bat.retired ? '' : '*'} (${bat.balls})</small></div><div class="tile-s">${esc(playerName(match, bat.id))} · ${esc(bat.team)}</div></div>`,
    );
  if (bowl)
    tiles.push(
      `<div class="tile"><div class="tile-k">Best bowling</div><div class="tile-n">${bowl.wickets}/${bowl.runs}</div><div class="tile-s">${esc(playerName(match, bowl.id))} · ${oversText(bowl.balls)} ov</div></div>`,
    );
  tiles.push(
    `<div class="tile"><div class="tile-k">Boundaries</div><div class="tile-n">${fours}<small> fours</small> ${sixes}<small> sixes</small></div><div class="tile-s">${bigOver && bigOver.runs ? `Biggest over: ${bigOver.runs} (${esc(bigOver.team)}, over ${bigOver.over})` : '&nbsp;'}</div></div>`,
  );
  return `<section class="tiles">${tiles.join('')}</section>`;
}

/** Both innings' running totals over by over, wickets marked: who was ahead, and when. */
function runRace(state: MatchState) {
  const lines = state.innings.slice(0, 2).filter((s) => s.legalBalls > 0);
  if (!lines.length) return '';
  const W = 720;
  const H = 132;
  const L = 34;
  const B = 24;
  const overs = Math.max(...lines.map((s) => s.maxBalls / 6));
  const peak = Math.max(10, ...lines.map((s) => s.runs), state.innings[1].target ?? 0);
  const step = peak > 120 ? 40 : peak > 60 ? 20 : 10;
  const top = Math.ceil(peak / step) * step;
  const x = (o: number) => L + (o / overs) * (W - L - 10);
  const y = (r: number) => H - B - (r / top) * (H - B - 10);
  const grid = Array.from({ length: top / step + 1 }, (_, i) => i * step)
    .map((v) => `<line x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" class="${v ? 'g' : 'g0'}"/><text x="${L - 8}" y="${y(v) + 3}" class="ax" text-anchor="end">${v}</text>`)
    .join('');
  const ticks = Array.from({ length: overs + 1 }, (_, o) => o)
    .filter((o) => overs <= 12 || o % 2 === 0)
    .map((o) => `<text x="${x(o)}" y="${H - 6}" class="ax" text-anchor="middle">${o}</text>`)
    .join('');
  const paths = lines
    .map((s, i) => {
      let total = 0;
      const pts: [number, number][] = [[x(0), y(0)]];
      const dots: string[] = [];
      const done = Math.ceil(s.legalBalls / 6);
      s.overTotals.slice(0, done).forEach((o, k) => {
        total += o.runs;
        const ox = k + 1 === done && s.legalBalls % 6 ? k + (s.legalBalls % 6) / 6 : k + 1;
        pts.push([x(ox), y(total)]);
        for (let w = 0; w < o.wickets; w++) dots.push(`<circle cx="${x(ox)}" cy="${y(total) - w * 7}" r="3.6" class="wk"/>`);
      });
      const d = pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`;
      return `<path d="${area}" fill="${INNINGS_TINT[i]}" opacity="0.10"/><path d="${d}" fill="none" stroke="${INNINGS_TINT[i]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots.join('')}`;
    })
    .join('');
  const legend = lines
    .map((s, i) => `<span class="lg"><i style="background:${INNINGS_TINT[i]}"></i>${esc(s.battingTeam.name)} ${s.runs}/${s.wickets}</span>`)
    .join('');
  return `<section class="card race">
    <div class="card-head"><div class="label">Run race</div><div class="legend">${legend}<span class="lg"><i class="dot"></i>Wicket</span></div></div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">${grid}${ticks}${paths}</svg>
  </section>`;
}

function inningsHtml(match: Match, s: InningsState, label: string, tint: string, newPage: boolean) {
  const extras = s.extras.wide + s.extras.noball + s.extras.bye + s.extras.legbye + s.extras.penalty;
  const atCrease = [s.striker, s.nonStriker];
  const yetToBat = s.battingTeam.players.filter((p) => !s.batters.some((b) => b.id === p.id));
  const topRuns = Math.max(1, ...s.batters.map((b) => b.runs));

  const batting = s.batters
    .map((b) => {
      const notOut = !b.out && !b.retired && atCrease.includes(b.id);
      const marks = `${match.captains?.[s.battingTeam.id] === b.id ? '<span class="mark">c</span>' : ''}${match.keepers?.[s.battingTeam.id] === b.id ? '<span class="mark">wk</span>' : ''}`;
      return `<tr${b.runs === topRuns && b.runs > 0 ? ' class="top"' : ''}>
        <td class="name"><div class="who">${esc(playerName(match, b.id))}${notOut ? '<span class="no">*</span>' : ''}${marks}</div><div class="how${notOut ? ' live' : ''}">${esc(dismissal(match, b))}</div></td>
        <td class="runs"><b>${b.runs}</b><div class="share"><span style="width:${(b.runs / topRuns) * 100}%;background:${tint}"></span></div></td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td><td class="dim">${sr(b.runs, b.balls)}</td>
      </tr>`;
    })
    .join('');

  const bowling = s.bowlers
    .filter((b) => b.balls || b.runs)
    .map(
      (b) => `<tr>
        <td class="name"><div class="who">${esc(playerName(match, b.id))}</div>${b.wides || b.noballs ? `<div class="how">${b.wides} wd · ${b.noballs} nb</div>` : ''}</td>
        <td>${oversText(b.balls)}</td><td>${b.maidens}</td><td>${b.runs}</td><td><span class="wkts${b.wickets >= 2 ? ' hot' : b.wickets ? '' : ' zero'}">${b.wickets}</span></td><td class="dim">${econ(b.runs, b.balls)}</td>
      </tr>`,
    )
    .join('');

  const peak = Math.max(8, ...s.overTotals.map((o) => o.runs));
  const overs = s.overTotals
    .map(
      (o, i) => `<div class="ov">
        <div class="ov-v">${o.runs}</div>
        <div class="ov-bar${o.runs >= 10 ? ' hot' : ''}" style="height:${Math.max(3, (o.runs / peak) * 52)}px${o.runs >= 10 ? `;background:${tint}` : ''}"></div>
        <div class="ov-w">${'<i></i>'.repeat(Math.min(o.wickets, 3))}</div>
        <div class="ov-n">${i + 1}</div>
      </div>`,
    )
    .join('');

  const fow = s.fallOfWickets
    .map((f) => `<span class="fw"><b>${f.runs}-${f.wicket}</b> ${esc(playerName(match, f.player))} <em>${f.over}</em></span>`)
    .join('');

  return `<section class="innings${newPage ? ' new-page' : ''}">
    <div class="inn-head" style="--tint:${tint}">
      <div><div class="eyebrow">${label}</div><div class="team">${esc(s.battingTeam.name)}</div></div>
      <div class="inn-total"><div class="total">${s.runs}<span>/${s.wickets}</span></div><div class="inn-meta">${oversText(s.legalBalls)} overs · RR ${rate(s.runs, s.legalBalls)}${s.target ? ` · target ${s.target}` : ''}</div></div>
    </div>
    <div class="card flush">
      <table>
        <thead><tr><th class="name">Batter</th><th class="runs">R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
        <tbody>${batting}
          <tr class="foot"><td class="name">Extras <span class="how">wd ${s.extras.wide} · nb ${s.extras.noball} · b ${s.extras.bye} · lb ${s.extras.legbye}${s.extras.penalty ? ` · pen ${s.extras.penalty}` : ''}</span></td><td class="runs"><b>${extras}</b></td><td colspan="4"></td></tr>
          <tr class="foot sum"><td class="name">Total</td><td class="runs"><b>${s.runs}/${s.wickets}</b></td><td colspan="4" class="dim">${oversText(s.legalBalls)} overs</td></tr>
        </tbody>
      </table>
      ${yetToBat.length ? `<div class="yet"><span class="label">Yet to bat</span> ${yetToBat.map((p) => esc(p.name)).join(' · ')}</div>` : ''}
    </div>
    ${fow ? `<div class="fow"><span class="label">Fall of wickets</span><div class="fws">${fow}</div></div>` : ''}
    <div class="split">
      <div class="card flush">
        <table>
          <thead><tr><th class="name">Bowler · ${esc(s.bowlingTeam.name)}</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
          <tbody>${bowling || '<tr><td class="name how" colspan="6">No overs bowled</td></tr>'}</tbody>
        </table>
      </div>
      ${
        s.overTotals.some((o) => o.runs || o.wickets)
          ? `<div class="card overs"><div class="label">Runs per over</div><div class="ov-row">${overs}</div></div>`
          : ''
      }
    </div>
  </section>`;
}

function matchHtml(match: Match, all: Match[]) {
  const state = matchState(match);
  const series = match.series ? seriesState(all.filter((m) => m.series?.id === match.series!.id)) : null;
  const date = new Date(match.createdAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const toss = match.teams.find((t) => t.id === match.toss.winner)?.name ?? '';

  const played = playedInnings(match, state);
  // The cover's scoreboard: each side's main innings, the winner lit.
  const sides = match.teams.map((t) => {
    const s = state.innings.slice(0, 2).find((x) => x.battingTeam.id === t.id && x.legalBalls + x.runs > 0);
    return { t, s, won: state.winner === t.id };
  });
  const scoreboard = sides
    .map(
      ({ t, s, won }, i) => `<div class="side${won ? ' won' : ''}${state.winner && !won ? ' lost' : ''}${i ? ' right' : ''}">
        <div class="side-name">${esc(t.name)}${won ? '<span class="win">Won</span>' : ''}</div>
        <div class="side-score">${s ? `${s.runs}<span>/${s.wickets}</span>` : '–'}</div>
        <div class="side-ov">${s ? `${oversText(s.legalBalls)} overs` : 'Yet to bat'}</div>
      </div>`,
    )
    .join('<div class="vs">vs</div>');

  return `<article class="match">
    <section class="cover">
      <div class="cover-top">
        <div class="brand"><span class="logo">${appIconSvg(24, { id: 'hm' })}</span>Crease</div>
        <div class="cover-date">${esc(date)}</div>
      </div>
      ${series ? `<div class="series">${esc(series.name)} · Match ${match.series!.number} of ${series.of} · ${esc(series.status)}</div>` : '<div class="series">Match report</div>'}
      <div class="board">${scoreboard}</div>
      <div class="result${state.result ? '' : ' live'}">${esc(state.result ?? 'Match in progress')}</div>
      <div class="toss">${esc(toss)} won the toss and chose to ${match.toss.choice} · ${match.rules.overs} overs · ${match.rules.playersPerSide} a side</div>
      <div class="ghost">${esc(sides.find((x) => x.won)?.t.name ?? 'Crease')}</div>
    </section>
    ${highlights(match, state)}
    ${played.map(({ s, i, label }) => inningsHtml(match, s, label, INNINGS_TINT[i % 2], i === 1)).join('')}
    ${runRace(state)}
    <footer><span class="logo sm">${appIconSvg(15, { id: 'fm' })}</span> Scored ball by ball with Crease</footer>
  </article>`;
}

/** Fonts and styles shared by every printed report (match reports and the record book). */
export const REPORT_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 12mm 12mm 14mm; }
  :root { --ink: #101210; --muted: #6B6F66; --faint: #A3A79D; --soft: #F4F5F1; --line: #E9EBE5; --volt: #D7FF3A; --volt-ink: #3D7400; --red: #E0301E; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: Inter, -apple-system, Helvetica, Arial, sans-serif; color: var(--ink); font-size: 10.5px; line-height: 1.35; background: #fff; }
  @media screen { body { padding: 28px; max-width: 840px; margin: 0 auto; } }
  .match { break-after: page; }
  .match:last-child { break-after: auto; }
  .brand, .side-score, .side-name, .result, .team, .total, .tile-n, .tile-v, .ghost, .logo { font-family: 'Bricolage Grotesque', Inter, sans-serif; }
  .label, .eyebrow, th, .tile-k, .series { font-size: 8.5px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; color: var(--muted); }

  /* Cover: the black scoreboard */
  .cover { position: relative; overflow: hidden; background: #0C0D0B; color: #F4F4EE; border-radius: 18px; padding: 16px 22px 14px;
    background-image: repeating-linear-gradient(90deg, rgba(255,255,255,.028) 0 44px, transparent 44px 88px), radial-gradient(120% 90% at 50% -20%, rgba(215,255,58,.20), transparent 60%); }
  .cover-top { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 7px; font-weight: 900; font-size: 18px; letter-spacing: .4px; }
  .logo { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-right: 8px; vertical-align: middle; }
  .logo svg { display: block; }
  .logo.sm { width: 15px; height: 15px; margin-right: 5px; }
  .cover-date { font-size: 10px; color: #9C9C94; font-weight: 500; }
  .cover .series { color: var(--volt); margin-top: 12px; }
  .board { display: flex; align-items: flex-end; gap: 16px; margin-top: 6px; position: relative; z-index: 1; }
  .side { flex: 1; }
  .side.right { text-align: right; }
  .side-name { font-weight: 800; font-size: 20px; color: #C9C9C1; display: flex; align-items: center; gap: 8px; }
  .side.right .side-name { justify-content: flex-end; }
  .win { font-family: Inter, sans-serif; font-style: normal; font-size: 8px; font-weight: 800; letter-spacing: 1.2px; background: var(--volt); color: #0A0A0A; border-radius: 99px; padding: 2px 7px; }
  .side-score { font-weight: 900; font-size: 56px; line-height: .95; letter-spacing: -1px; color: #F4F4EE; }
  .side-score span { color: #6F6F68; font-size: 32px; }
  .side.won .side-score { color: var(--volt); }
  .side.lost .side-score { color: #D9D9D1; }
  .side-ov { font-size: 10px; color: #9C9C94; margin-top: 2px; }
  .vs { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 800; font-size: 18px; color: #5F5F59; padding-bottom: 30px; }
  .result { display: inline-block; margin-top: 10px; background: var(--volt); color: #0A0A0A; font-weight: 900; font-size: 19px; padding: 4px 12px 3px; border-radius: 8px; position: relative; z-index: 1; }
  .result.live { background: var(--red); color: #fff; }
  .toss { margin-top: 8px; font-size: 10px; color: #9C9C94; position: relative; z-index: 1; }
  .ghost { position: absolute; right: -6px; bottom: -22px; font-weight: 900; font-size: 120px; line-height: 1; color: rgba(255,255,255,.04); white-space: nowrap; }

  /* Highlight tiles */
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; break-inside: avoid; }
  .tile { background: var(--soft); border-radius: 14px; padding: 9px 12px; }
  .tile.mom { background: var(--volt); }
  .tile.mom .tile-k { color: #3B4A00; }
  .tile-v { font-weight: 900; font-size: 20px; line-height: 1.02; margin-top: 5px; }
  .tile-n { font-weight: 900; font-size: 26px; line-height: 1; margin-top: 5px; }
  .tile-n small { font-size: 13px; color: var(--muted); font-weight: 800; }
  .tile-s { font-size: 9.5px; color: var(--muted); margin-top: 4px; }
  .tile.mom .tile-s { color: #33400A; }

  /* Cards */
  .card { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; }
  .card.flush { padding: 2px 0 0; overflow: hidden; }
  .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .race { margin-top: 14px; break-inside: avoid; }
  .race svg { display: block; }
  .race .g { stroke: #EEF0EA; stroke-width: 1; }
  .race .g0 { stroke: #CFD2CA; stroke-width: 1; }
  .race .ax { font-size: 9px; fill: var(--faint); font-family: Inter, sans-serif; }
  .race .wk { fill: var(--red); stroke: #fff; stroke-width: 1.5; }
  .legend { display: flex; gap: 12px; }
  .lg { display: inline-flex; align-items: center; gap: 5px; font-size: 9.5px; font-weight: 600; color: #3A3D36; }
  .lg i { width: 14px; height: 4px; border-radius: 2px; display: inline-block; }
  .lg i.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--red); }

  /* Innings */
  .innings { margin-top: 14px; }
  .innings.new-page { break-before: page; margin-top: 0; }
  .inn-head { display: flex; justify-content: space-between; align-items: flex-end; margin: 0 2px 8px; break-after: avoid; }
  .inn-head .eyebrow { display: inline-flex; align-items: center; gap: 6px; }
  .inn-head .eyebrow::before { content: ''; width: 14px; height: 4px; border-radius: 2px; background: var(--tint); }
  .team { font-weight: 900; font-size: 30px; line-height: 1; margin-top: 3px; }
  .inn-total { text-align: right; }
  .total { font-weight: 900; font-size: 36px; line-height: .95; }
  .total span { color: var(--faint); font-size: 24px; }
  .inn-meta { font-size: 9.5px; color: var(--muted); margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { text-align: right; padding: 7px 12px 6px; font-size: 8px; border-bottom: 1px solid var(--line); }
  td { text-align: right; padding: 4px 12px; border-bottom: 1px solid #F1F2EE; font-variant-numeric: tabular-nums; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: 0; }
  th.name, td.name { text-align: left; width: 44%; }
  th.runs, td.runs { width: 15%; }
  .who { font-weight: 600; font-size: 11px; display: flex; align-items: center; gap: 5px; }
  .no { color: var(--volt-ink); font-weight: 800; margin-left: -3px; }
  .mark { font-size: 7.5px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: var(--muted); background: var(--soft); border-radius: 4px; padding: 1px 4px; }
  .how { color: var(--muted); font-size: 9px; margin-top: 1px; font-weight: 400; }
  .how.live { color: var(--volt-ink); font-weight: 600; }
  td.runs b { font-size: 13px; font-weight: 800; }
  .share { height: 3px; border-radius: 2px; background: #EEF0EA; margin: 3px 0 0 auto; width: 42px; overflow: hidden; display: flex; justify-content: flex-end; }
  .share span { display: block; height: 100%; border-radius: 2px; }
  tr.top td { background: #FAFBF7; }
  .dim { color: var(--muted); }
  tr.foot td { background: var(--soft); border-bottom: 0; padding-top: 6px; padding-bottom: 6px; }
  tr.sum td { border-top: 1px solid var(--line); font-weight: 700; }
  tr.sum td.runs b { font-size: 14px; }
  .yet { padding: 8px 12px 9px; border-top: 1px solid var(--line); font-size: 10px; color: #3A3D36; }
  .yet .label { margin-right: 6px; }
  .fow { margin: 10px 2px 0; break-inside: avoid; }
  .fws { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
  .fw { background: var(--soft); border-radius: 99px; padding: 3px 9px; font-size: 9.5px; color: #3A3D36; }
  .fw b { color: var(--ink); }
  .fw em { font-style: normal; color: var(--faint); margin-left: 2px; }
  .split { display: grid; grid-template-columns: 1.55fr 1fr; gap: 8px; margin-top: 10px; break-inside: avoid; }
  .wkts { display: inline-block; min-width: 18px; text-align: center; font-weight: 800; border-radius: 5px; padding: 1px 4px; }
  .wkts.hot { background: var(--volt); color: #0A0A0A; }
  .wkts.zero { color: var(--faint); font-weight: 600; }
  .overs { display: flex; flex-direction: column; }
  .ov-row { flex: 1; display: flex; align-items: flex-end; gap: 3px; margin-top: 6px; min-height: 84px; }
  .ov { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
  .ov-v { font-size: 8.5px; font-weight: 700; color: #3A3D36; margin-bottom: 2px; }
  .ov-bar { width: 100%; max-width: 18px; border-radius: 4px 4px 2px 2px; background: #DFE2DA; }
  .ov-w { height: 8px; display: flex; gap: 1.5px; align-items: center; margin-top: 2px; }
  .ov-w i { width: 4px; height: 4px; border-radius: 50%; background: var(--red); display: block; }
  .ov-n { font-size: 8px; color: var(--faint); }

  /* Footer */
  footer { break-before: avoid; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--line); color: var(--faint); font-size: 8.5px; display: flex; align-items: center; justify-content: center; }
</style>`;

/** One HTML document, a match after another, ready for printing or turning into a PDF. */
export function matchReportHtml(matches: Match[], all: Match[] = matches): string {
  const title = matches.length === 1 ? `${matches[0].teams[0].name} vs ${matches[0].teams[1].name}` : `${matches.length} matches`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)} · Crease</title>
${REPORT_HEAD}</head>
<body>${matches.map((m) => matchHtml(m, all)).join('')}</body></html>`;
}
