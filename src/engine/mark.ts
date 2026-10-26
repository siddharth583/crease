// The Crease mark, in one place: the app icon, the logo in the app and the logo on reports are all drawn from it.
// The ball in flight: a seamed ball leaving three speed lines behind it, volt on the night pitch.

export const MARK_VOLT = '#D7FF3A';
const SEAM = '#0B120D';
/** The icon's background, top to bottom: the pitch at night. */
export const MARK_PITCH = ['#1F3826', '#122017', '#0A110C'] as const;

/**
 * A ball with its seam: two arcs of a wider circle crossing it, with slanted stitches between them. `id` keeps the
 * clip path apart when several marks share a page.
 */
function seamBall(cx: number, cy: number, r: number, fill: string, seam: string, id: string) {
  const R = r * 3.4; // the seam's curve
  const ox = cx + R * 0.7071 - r * 0.12;
  const oy = cy - R * 0.7071 + r * 0.12;
  const f = (n: number) => n.toFixed(2);
  const arcAt = (rr: number) => `M ${f(ox + rr * Math.cos(Math.PI / 2))} ${f(oy + rr)} A ${f(rr)} ${f(rr)} 0 0 1 ${f(ox - rr)} ${f(oy)}`;
  const gap = r * 0.2;
  const w = r * 0.085;
  let stitches = '';
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (0.655 + (0.19 * i) / 10);
    const x = ox + R * Math.cos(a);
    const y = oy + R * Math.sin(a);
    const nx = Math.cos(a), ny = Math.sin(a), tx = -ny, ty = nx;
    const L = gap * 0.62;
    stitches += `<line x1="${f(x - nx * L + tx * L * 0.55)}" y1="${f(y - ny * L + ty * L * 0.55)}" x2="${f(x + nx * L - tx * L * 0.55)}" y2="${f(y + ny * L - ty * L * 0.55)}" stroke="${seam}" stroke-width="${f(w)}" stroke-linecap="round"/>`;
  }
  return `<clipPath id="${id}s"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>
<g clip-path="url(#${id}s)"><path d="${arcAt(R - gap)}" fill="none" stroke="${seam}" stroke-width="${f(w)}"/><path d="${arcAt(R + gap)}" fill="none" stroke="${seam}" stroke-width="${f(w)}"/>${stitches}</g>`;
}

/** The mark on a 100-unit square, in one colour (the seam cut in `seam`). */
export function markSvg(id = 'cm', color = MARK_VOLT, seam = SEAM) {
  return `<rect x="14" y="36" width="34" height="6" rx="3" fill="${color}" opacity="0.45"/>
<rect x="22" y="47" width="30" height="6" rx="3" fill="${color}" opacity="0.7"/>
<rect x="10" y="58" width="36" height="6" rx="3" fill="${color}" opacity="0.45"/>
${seamBall(66, 50, 21, color, seam, id)}`;
}

/**
 * The whole icon as an SVG: the pitch background with its glow and the mark. `rounded` gives it the corners of an app
 * icon on a phone (for logos drawn in the app and on reports); the icon files themselves stay square.
 */
export function appIconSvg(size: number, { rounded = true, id = 'cm', mark = true } = {}) {
  const rx = rounded ? 23 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
<defs><linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${MARK_PITCH[0]}"/><stop offset="0.55" stop-color="${MARK_PITCH[1]}"/><stop offset="1" stop-color="${MARK_PITCH[2]}"/></linearGradient>
<radialGradient id="${id}g" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="${MARK_VOLT}" stop-opacity="0.14"/><stop offset="1" stop-color="${MARK_VOLT}" stop-opacity="0"/></radialGradient></defs>
<rect width="100" height="100" rx="${rx}" fill="url(#${id}p)"/><rect width="100" height="100" rx="${rx}" fill="url(#${id}g)"/>
${mark ? markSvg(id) : ''}</svg>`;
}

/**
 * The mark alone on a transparent square, filling `fill` of it: Android's foreground layer and the splash. With
 * `cutSeam` the seam is cut out of the ball instead of drawn, for Android's one-colour themed icon.
 */
export function markAloneSvg(size: number, fill: number, { color = MARK_VOLT, cutSeam = false } = {}) {
  const inset = (100 - fill * 100) / 2;
  const body = cutSeam
    ? `<mask id="mcut"><rect width="100" height="100" fill="#000"/>${markSvg('mk', '#fff', '#000')}</mask><rect width="100" height="100" fill="${color}" mask="url(#mcut)"/>`
    : markSvg('ma', color);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><g transform="translate(${inset} ${inset}) scale(${fill})">${body}</g></svg>`;
}
