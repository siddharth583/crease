import { fileDate } from './backup.ts';
import { appIconSvg } from './mark.ts';
import { REPORT_HEAD } from './report.ts';
import { nameKey, sideStrength, strengthOf, type LineupSide, type Strength } from './teams.ts';

// Two sides as a picture to post in the group, made to be read on a phone: dark like the app at night, the two sides
// side by side, each player with the strength they bring, how even it is at the top.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** How the picture is drawn: narrow for a phone screen, on the night background, and sent to the share sheet. */
export const LINEUP_IMAGE = { width: 560, background: '#0B0F0C', padding: 0, share: true } as const;

/** The picture's file name: "Copan Strikers vs Copan Royals - Line-up - 30 Oct 2026.png". */
export const lineupFileName = (sides: LineupSide[], when = new Date()) =>
  `${`${sides[0].name} vs ${sides[1].name}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()} - Line-up - ${fileDate(when)}.png`;

/** A strength's colour, as the app shows ratings: volt for the best, cyan for good, red for poor. */
const tone = (n: number) => (n >= 8 ? 'best' : n >= 6.5 ? 'good' : n < 5 ? 'poor' : 'plain');

export function lineupHtml(sides: [LineupSide, LineupSide], table: Map<string, Strength>, when = new Date()): string {
  const s = sides.map((side) => sideStrength(side.players.map((n) => strengthOf(table, n))));
  const apart = Math.round(Math.abs(s[0].power - s[1].power) * 10) / 10;
  const verdict = apart < 0.2 ? 'Dead even' : `${esc(s[0].power > s[1].power ? sides[0].name : sides[1].name)} +${apart.toFixed(1)}`;

  const side = (i: number) => {
    const { name, captain } = sides[i];
    const isCaptain = (n: string) => Boolean(captain) && nameKey(captain!) === nameKey(n);
    // The captain first, then the rest best first.
    const players = [...s[i].players].sort((p, q) => Number(isCaptain(q.name)) - Number(isCaptain(p.name)));
    const facts = [`Form ${s[i].form === null ? '–' : s[i].form.toFixed(1)}`, `${s[i].bowlers} bowlers`, `${s[i].keepers} WK`];
    return `<div class="lu-side lu-s${i}">
      <div class="lu-band"></div>
      <div class="lu-side-head">
        <div class="lu-side-name">${esc(name)}</div>
        <div class="lu-facts">${facts.map((f) => `<span>${f}</span>`).join('')}</div>
      </div>
      ${players
        .map((p) => {
          const marks = [isCaptain(p.name) && '<i class="lu-c">C</i>', p.keeper && '<i>WK</i>', p.keepsSometimes && '<i>(WK)</i>', p.guest && '<i>GUEST</i>'].filter(Boolean).join('');
          return `<div class="lu-row">
          <div class="lu-who"><div class="lu-nm">${esc(p.name)}${marks ? ` ${marks}` : ''}</div><div class="lu-sub">${p.form === null ? 'No matches yet' : `Form ${p.form.toFixed(1)}`}</div></div>
          <div class="lu-chip lu-${tone(p.power)}">${p.power.toFixed(1)}</div>
        </div>`;
        })
        .join('')}
    </div>`;
  };

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Line-up · Crease</title>
${REPORT_HEAD}
<style>
  body { background: #0B0F0C; }
  .lu-poster { position: relative; overflow: hidden; color: #F1F5EE; padding: 26px 22px 18px; font-family: Inter, sans-serif;
    background-image: radial-gradient(130% 55% at 50% -10%, rgba(215,255,58,.16), transparent 62%), repeating-linear-gradient(90deg, rgba(255,255,255,.022) 0 40px, transparent 40px 80px); }
  .lu-top { display: flex; align-items: center; justify-content: space-between; }
  .lu-brand { display: flex; align-items: center; gap: 8px; font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 19px; letter-spacing: -.3px; }
  .lu-brand .logo { margin-right: 0; }
  .lu-date { font-size: 12px; color: #98A396; font-weight: 600; }
  .lu-eyebrow { margin-top: 22px; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #D7FF3A; }
  .lu-match { margin-top: 6px; font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 34px; line-height: 1.02; letter-spacing: -1px; }
  .lu-match em { font-style: normal; color: #5B665C; font-size: 24px; padding: 0 2px; }
  .lu-board { display: flex; align-items: center; margin-top: 18px; padding: 14px 18px; border-radius: 20px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); }
  .lu-board .lu-n { flex: 1; font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 46px; line-height: 1; letter-spacing: -1.5px; }
  .lu-board .lu-n small { display: block; margin-top: 4px; font-family: Inter, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #98A396; }
  .lu-board .lu-n.lu-b { text-align: right; }
  .lu-n.lu-a { color: #D7FF3A; } .lu-n.lu-b { color: #B9A6FF; }
  .lu-pill { padding: 7px 14px; border-radius: 99px; background: #D7FF3A; color: #0A0D06; font-weight: 800; font-size: 13px; white-space: nowrap; }
  .lu-sides { display: flex; gap: 10px; margin-top: 14px; align-items: flex-start; }
  .lu-side { position: relative; flex: 1; min-width: 0; border-radius: 18px; background: #121814; border: 1px solid rgba(214,236,200,.08); overflow: hidden; }
  .lu-band { height: 5px; }
  .lu-s0 .lu-band { background: #D7FF3A; } .lu-s1 .lu-band { background: #B9A6FF; }
  .lu-side-head { padding: 12px 14px 10px; border-bottom: 1px solid rgba(214,236,200,.08); }
  .lu-side-name { font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 19px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-facts { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
  .lu-facts span { font-size: 10px; font-weight: 700; color: #C9D2C6; background: rgba(255,255,255,.06); border-radius: 6px; padding: 3px 6px; }
  .lu-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px 8px 14px; border-top: 1px solid rgba(214,236,200,.05); }
  .lu-side-head + .lu-row { border-top: 0; }
  .lu-who { flex: 1; min-width: 0; }
  .lu-nm { font-weight: 700; font-size: 13.5px; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lu-nm i { font-style: normal; font-size: 8.5px; font-weight: 800; letter-spacing: .5px; color: #98A396; border: 1px solid rgba(214,236,200,.2); border-radius: 4px; padding: 0 3px; margin-left: 3px; vertical-align: 2px; }
  .lu-nm i.lu-c { color: #0A0D06; background: #D7FF3A; border-color: #D7FF3A; }
  .lu-sub { font-size: 10.5px; color: #8C978A; margin-top: 1px; }
  .lu-chip { min-width: 38px; text-align: center; padding: 5px 6px; border-radius: 9px; font-family: 'Bricolage Grotesque', Inter, sans-serif; font-weight: 900; font-size: 14px; background: #1A221C; color: #F1F5EE; }
  .lu-chip.lu-best { background: #D7FF3A; color: #0A0D06; } .lu-chip.lu-good { background: rgba(127,230,255,.16); color: #7FE6FF; } .lu-chip.lu-poor { background: rgba(255,90,60,.16); color: #FF8A73; }
  .lu-foot { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 16px; font-size: 10.5px; color: #6E7A6C; }
</style></head>
<body><div class="lu-poster">
  <div class="lu-top"><div class="lu-brand"><span class="logo">${appIconSvg(26, { id: 'lu' })}</span>crease</div><div class="lu-date">${esc(fileDate(when))}</div></div>
  <div class="lu-eyebrow">Today’s sides</div>
  <div class="lu-match">${esc(sides[0].name)} <em>v</em> ${esc(sides[1].name)}</div>
  <div class="lu-board">
    <div class="lu-n lu-a">${s[0].power.toFixed(1)}<small>${esc(sides[0].name)}</small></div>
    <div class="lu-pill">${verdict}</div>
    <div class="lu-n lu-b">${s[1].power.toFixed(1)}<small>${esc(sides[1].name)}</small></div>
  </div>
  <div class="lu-sides">${side(0)}${side(1)}</div>
  <div class="lu-foot">Strength out of 10, on current form · picked with Crease</div>
</div></body></html>`;
}
