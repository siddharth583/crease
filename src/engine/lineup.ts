import { fileDate } from './backup.ts';
import { appIconSvg } from './mark.ts';
import { REPORT_HEAD } from './report.ts';
import { nameKey, sideStrength, strengthOf, type LineupSide, type Strength } from './teams.ts';

// Two sides as a picture to post in the group: each side's players best first, with their form, and how even it is.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The picture's file name: "Copan Strikers vs Copan Royals - Line-up - 30 Oct 2026.png". */
export const lineupFileName = (sides: LineupSide[], when = new Date()) =>
  `${`${sides[0].name} vs ${sides[1].name}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()} - Line-up - ${fileDate(when)}.png`;

export function lineupHtml(sides: [LineupSide, LineupSide], table: Map<string, Strength>, when = new Date()): string {
  const s = sides.map((side) => sideStrength(side.players.map((n) => strengthOf(table, n))));
  const apart = Math.round(Math.abs(s[0].power - s[1].power) * 10) / 10;
  const verdict = apart < 0.2 ? 'As even as they come' : `${s[0].power > s[1].power ? sides[0].name : sides[1].name} ${apart.toFixed(1)} stronger`;
  const tint = ['#3D7400', '#5B3FCB'];
  const side = (i: number) => {
    const { name, captain } = sides[i];
    const isCaptain = (n: string) => Boolean(captain) && nameKey(captain!) === nameKey(n);
    // The captain first, then the rest best first.
    const players = [...s[i].players].sort((p, q) => Number(isCaptain(q.name)) - Number(isCaptain(p.name)));
    return `<div class="lu-side">
      <div class="lu-head" style="--tint:${tint[i]}">
        <div><div class="lu-name">${esc(name)}</div><div class="lu-meta">${players.length} players · form ${s[i].form === null ? '–' : s[i].form.toFixed(1)} · ${s[i].bowlers} bowlers</div></div>
        <div class="lu-power">${s[i].power.toFixed(1)}<small>/10</small></div>
      </div>
      ${players
        .map(
          (p, k) => `<div class="lu-row"><span class="lu-n">${k + 1}</span><span class="lu-who">${esc(p.name)}${isCaptain(p.name) ? ' <i>C</i>' : ''}${p.keeper ? ' <i>WK</i>' : ''}${p.guest ? ' <i class="dim">GUEST</i>' : ''}</span><span class="lu-form">${p.form === null ? 'new' : `form ${p.form.toFixed(1)}`}</span><b>${p.power.toFixed(1)}</b></div>`,
        )
        .join('')}
    </div>`;
  };
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Line-up · Crease</title>
${REPORT_HEAD}
<style>
  .lu-title { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 44px; line-height: 1; margin-top: 8px; }
  .lu-score { display: flex; align-items: baseline; gap: 12px; margin-top: 10px; font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 34px; color: #F4F4EE; }
  .lu-score span { font-size: 15px; font-weight: 800; color: var(--volt); }
  .lu-sides { display: flex; gap: 10px; margin-top: 12px; align-items: flex-start; }
  .lu-side { flex: 1; min-width: 0; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .lu-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 12px 14px; border-left: 5px solid var(--tint); background: var(--soft); }
  .lu-name { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 19px; line-height: 1.1; }
  .lu-meta { font-size: 9.5px; color: var(--muted); margin-top: 2px; }
  .lu-power { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 28px; color: var(--tint); white-space: nowrap; }
  .lu-power small { font-size: 12px; color: var(--faint); }
  .lu-row { display: flex; align-items: center; gap: 8px; padding: 7px 14px; border-top: 1px solid #F1F2EE; }
  .lu-n { width: 14px; color: var(--faint); font-weight: 800; font-size: 10px; }
  .lu-who { flex: 1; min-width: 0; font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-who i { font-style: normal; font-size: 8px; font-weight: 800; color: var(--volt-ink); letter-spacing: .5px; }
  .lu-who i.dim { color: var(--faint); }
  .lu-form { font-size: 9.5px; color: var(--muted); white-space: nowrap; }
  .lu-row b { width: 28px; text-align: right; font-size: 12.5px; }
</style></head>
<body><article>
  <section class="cover">
    <div class="cover-top"><div class="brand"><span class="logo">${appIconSvg(24, { id: 'lu' })}</span>Crease</div><div class="cover-date">${esc(fileDate(when))}</div></div>
    <div class="series">Today’s sides</div>
    <div class="lu-title">${esc(sides[0].name)} v ${esc(sides[1].name)}</div>
    <div class="lu-score">${s[0].power.toFixed(1)} v ${s[1].power.toFixed(1)} <span>${esc(verdict)}</span></div>
  </section>
  <div class="lu-sides">${side(0)}${side(1)}</div>
  <footer><span class="logo sm">${appIconSvg(15, { id: 'luf' })}</span> Strength out of 10 on current form · picked with Crease</footer>
</article></body></html>`;
}
