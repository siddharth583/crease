import { dismissal, matchState, oversText, playerName, type InningsState } from './engine.ts';
import { playerOfTheMatch, seriesState } from './stats.ts';
import type { Match } from './types.ts';

// A printable scorecard, one page per match: paper-white so it prints cheaply, with the app's black
// poster headings and volt accents. Turned into a PDF on the phone, or printed from the browser.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const sr = (r: number, b: number) => (b ? ((r * 100) / b).toFixed(1) : '–');
const econ = (r: number, b: number) => (b ? ((r * 6) / b).toFixed(2) : '–');

function inningsHtml(match: Match, s: InningsState, label: string) {
  const extras = s.extras.wide + s.extras.noball + s.extras.bye + s.extras.legbye + s.extras.penalty;
  const atCrease = [s.striker, s.nonStriker];
  const yetToBat = s.battingTeam.players.filter((p) => !s.batters.some((b) => b.id === p.id));

  const batting = s.batters
    .map((b) => {
      const notOut = !b.out && !b.retired && atCrease.includes(b.id);
      return `<tr>
        <td class="name">${esc(playerName(match, b.id))}${notOut ? '*' : ''}${match.captains?.[s.battingTeam.id] === b.id ? ' (c)' : ''}${match.keepers?.[s.battingTeam.id] === b.id ? ' †' : ''}<div class="how">${esc(dismissal(match, b))}</div></td>
        <td class="strong">${b.runs}</td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td><td>${sr(b.runs, b.balls)}</td>
      </tr>`;
    })
    .join('');

  const bowling = s.bowlers
    .filter((b) => b.balls || b.runs)
    .map(
      (b) => `<tr>
        <td class="name">${esc(playerName(match, b.id))}${b.wides || b.noballs ? `<div class="how">${b.wides} wd · ${b.noballs} nb</div>` : ''}</td>
        <td>${oversText(b.balls)}</td><td>${b.maidens}</td><td>${b.runs}</td><td class="strong">${b.wickets}</td><td>${econ(b.runs, b.balls)}</td>
      </tr>`,
    )
    .join('');

  const peak = Math.max(8, ...s.overTotals.map((o) => o.runs));
  const overs = s.overTotals
    .map(
      (o, i) => `<div class="bar-col">
        <div class="bar-val">${o.runs}</div>
        <div class="bar${o.runs >= 10 ? ' hot' : ''}" style="height:${Math.max(2, (o.runs / peak) * 46)}px"></div>
        <div class="bar-w">${'●'.repeat(Math.min(o.wickets, 3))}</div>
        <div class="bar-n">${i + 1}</div>
      </div>`,
    )
    .join('');

  return `<section class="innings">
    <div class="inn-head">
      <div><div class="eyebrow">${label}</div><div class="team">${esc(s.battingTeam.name)}</div></div>
      <div class="total">${s.runs}/${s.wickets}<span> ${oversText(s.legalBalls)} ov</span></div>
    </div>
    <table>
      <thead><tr><th class="name">Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
      <tbody>${batting}
        <tr class="extras"><td class="name">Extras <span class="how">wd ${s.extras.wide}, nb ${s.extras.noball}, b ${s.extras.bye}, lb ${s.extras.legbye}${s.extras.penalty ? `, pen ${s.extras.penalty}` : ''}</span></td><td class="strong">${extras}</td><td colspan="4"></td></tr>
      </tbody>
    </table>
    ${yetToBat.length ? `<p class="note"><b>Yet to bat</b> ${yetToBat.map((p) => esc(p.name)).join(', ')}</p>` : ''}
    ${
      s.fallOfWickets.length
        ? `<p class="note"><b>Fall of wickets</b> ${s.fallOfWickets
            .map((f) => `${f.runs}-${f.wicket} (${esc(playerName(match, f.player))}, ${f.over})`)
            .join(' &nbsp;·&nbsp; ')}</p>`
        : ''
    }
    <table>
      <thead><tr><th class="name">Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
      <tbody>${bowling || '<tr><td class="name how" colspan="6">No overs bowled</td></tr>'}</tbody>
    </table>
    ${s.overTotals.some((o) => o.runs || o.wickets) ? `<div class="chart-title">Runs per over</div><div class="chart">${overs}</div>` : ''}
  </section>`;
}

function matchHtml(match: Match, all: Match[]) {
  const state = matchState(match);
  const series = match.series ? seriesState(all.filter((m) => m.series?.id === match.series!.id)) : null;
  const potm = playerOfTheMatch(match);
  const [a, b] = match.teams;
  const date = new Date(match.createdAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const toss = match.teams.find((t) => t.id === match.toss.winner)?.name ?? '';
  const r = match.rules;
  const rules = [
    `${r.overs} over${r.overs === 1 ? '' : 's'}`,
    `${r.playersPerSide} a side`,
    r.extraRun ? 'run for wides & no-balls' : 'no run for wides & no-balls',
    r.reball ? 're-bowled' : 'not re-bowled',
    r.freeHit ? 'free hits' : '',
    r.maxOversPerBowler
      ? r.extraOverBowlers
        ? `${r.extraOverBowlers} bowlers ${r.maxOversPerBowler + 1} overs, the rest ${r.maxOversPerBowler}`
        : `${r.maxOversPerBowler} overs a bowler`
      : '',
    r.bouncer
      ? r.bouncer.fair
        ? `${r.bouncer.fair} bounce${r.bouncer.fair === 1 ? '' : 's'} an over (fair or wide), then ${r.bouncer.calledAs === 'wide' ? 'wide' : 'no ball'}`
        : `every bounce a ${r.bouncer.calledAs === 'wide' ? 'wide' : 'no ball'}`
      : '',
    r.lastManStands ? 'last man stands' : '',
  ].filter(Boolean);

  const played = state.innings.filter((_, i) => match.innings[i]?.events.length > 0);
  return `<article class="match">
    <header>
      <div class="brand"><span class="logo">C</span> CREASE <span class="date">${esc(date)}</span></div>
      ${series ? `<div class="series">${esc(series.name)} · match ${match.series!.number} of ${series.of} · ${esc(series.status)}</div>` : ''}
      <h1>${esc(a.name)} <span class="vs">vs</span> ${esc(b.name)}</h1>
      <div class="result${state.result ? '' : ' live'}">${esc(state.result ?? 'Match in progress')}</div>
      <div class="meta">${esc(toss)} won the toss and chose to ${match.toss.choice} &nbsp;·&nbsp; ${esc(rules.join(' · '))}</div>
      ${potm ? `<div class="potm"><span>Man of the match</span> <b>${esc(potm.name)}</b> ${esc(potm.summary)}</div>` : ''}
    </header>
    ${played.map((s, i) => inningsHtml(match, s, i >= 2 ? 'Super over' : i === 0 ? '1st innings' : '2nd innings')).join('')}
    <footer>Scored ball by ball with Crease</footer>
  </article>`;
}

/** One HTML document, a page per match, ready for printing or turning into a PDF. */
export function matchReportHtml(matches: Match[], all: Match[] = matches): string {
  const title = matches.length === 1 ? `${matches[0].teams[0].name} vs ${matches[0].teams[1].name}` : `${matches.length} matches`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)} · Crease</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,800;1,900&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: Inter, -apple-system, Helvetica, Arial, sans-serif; color: #111; font-size: 11px; }
  @media screen { body { padding: 24px; max-width: 820px; margin: 0 auto; } }
  .match { page-break-after: always; break-after: page; }
  .match:last-child { page-break-after: auto; break-after: auto; }
  .poster, h1, .team, .total, .result, .logo, .brand { font-family: 'Barlow Condensed', 'Arial Narrow', Impact, sans-serif; font-style: italic; font-weight: 900; text-transform: uppercase; }
  header { border-bottom: 4px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { display: flex; align-items: center; gap: 6px; font-size: 16px; letter-spacing: .5px; }
  .logo { display: inline-block; background: #D7FF3A; color: #0A0A0A; width: 22px; height: 22px; line-height: 22px; text-align: center; border-radius: 4px; }
  .date { margin-left: auto; font-family: Inter, sans-serif; font-style: normal; font-weight: 600; font-size: 11px; color: #666; text-transform: none; }
  h1 { font-size: 40px; line-height: 1; margin: 10px 0 8px; letter-spacing: -.5px; }
  .vs { color: #8a8a8a; font-size: 26px; }
  .result { display: inline-block; background: #D7FF3A; color: #0A0A0A; padding: 3px 10px; font-size: 20px; border-radius: 4px; }
  .result.live { background: #FF4B2B; color: #fff; }
  .meta { color: #555; margin-top: 8px; }
  .series { margin-top: 10px; font-weight: 700; font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; color: #555; }
  .potm { margin-top: 8px; padding: 6px 10px; background: #0A0A0A; color: #fff; border-radius: 4px; display: inline-block; }
  .potm span { color: #D7FF3A; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 1px; margin-right: 6px; }
  .innings { margin-bottom: 16px; break-inside: avoid; }
  .inn-head { display: flex; justify-content: space-between; align-items: flex-end; border-left: 5px solid #D7FF3A; padding-left: 8px; margin-bottom: 6px; }
  .eyebrow { font-size: 9px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: #777; }
  .team { font-size: 24px; line-height: 1; }
  .total { font-size: 32px; line-height: 1; }
  .total span { font-size: 16px; color: #777; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th { text-align: right; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #777; padding: 4px 6px; border-bottom: 1.5px solid #111; }
  td { text-align: right; padding: 4px 6px; border-bottom: 1px solid #e6e6e6; font-variant-numeric: tabular-nums; }
  th.name, td.name { text-align: left; width: 46%; }
  td.strong { font-weight: 700; }
  .how { color: #777; font-size: 9.5px; font-weight: 400; }
  .extras td { border-bottom: 1.5px solid #111; }
  .note { margin: 4px 0 8px; color: #333; }
  .chart-title { font-size: 9px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: #777; margin: 8px 0 4px; }
  .chart { display: flex; align-items: flex-end; gap: 4px; height: 86px; }
  .bar-col { flex: 1; max-width: 26px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
  .bar { width: 100%; background: #cfcfcf; border-radius: 2px; }
  .bar.hot { background: #B8E000; }
  .bar-val, .bar-n { font-size: 8.5px; color: #555; }
  .bar-w { color: #FF4B2B; font-size: 7px; height: 9px; line-height: 9px; }
  footer { margin-top: 10px; color: #999; font-size: 9px; text-align: right; }
</style></head>
<body>${matches.map((m) => matchHtml(m, all)).join('')}</body></html>`;
}
