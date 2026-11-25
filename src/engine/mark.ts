// The Crease mark, in one place: the app icon, the logo in the app and the logo on reports are all drawn from it.
// Three ivory stumps at the popping crease, one brass bail knocked into the air, on the outfield green: the moment every
// scorer is waiting for. No red against the green on purpose.

export const MARK_VOLT = '#F4F1E6';
/** The standing bail and the crease line: champagne brass, like an honours board. */
const GRASS = '#DDB66E';
/** The bail that flies: the brass, brighter. */
const LEATHER = '#F3D79C';
/** The icon's background, top to bottom: the pitch under the floodlights. */
export const MARK_PITCH = ['#1F4D36', '#0D2418', '#07120C'] as const;

/**
 * The mark on a 100-unit square: stumps and a flying bail in `color`, the standing bail and the crease line in
 * `accent`. (`seam` is kept for older callers; the new mark has none.)
 */
export function markSvg(_id = 'cm', color = MARK_VOLT, _seam?: string, accent = GRASS, flying = LEATHER) {
  return `<rect x="30" y="38" width="9" height="42" rx="4.5" fill="${color}"/>
<rect x="45.5" y="38" width="9" height="42" rx="4.5" fill="${color}"/>
<rect x="61" y="38" width="9" height="42" rx="4.5" fill="${color}"/>
<rect x="31" y="31" width="22" height="5" rx="2.5" fill="${accent}"/>
<rect x="55" y="31" width="15" height="5" rx="2.5" fill="${flying}" transform="rotate(-38 62.5 33.5) translate(5 -17)"/>
<circle cx="76" cy="26" r="1.9" fill="${flying}" opacity="0.7"/><circle cx="81" cy="20" r="1.4" fill="${flying}" opacity="0.5"/>
<rect x="16" y="85" width="68" height="4.4" rx="2.2" fill="${accent}" opacity="0.7"/>`;
}

/**
 * The whole icon as an SVG: the pitch background with its glow and the mark. `rounded` gives it the corners of an app
 * icon on a phone (for logos drawn in the app and on reports); the icon files themselves stay square.
 */
export function appIconSvg(size: number, { rounded = true, id = 'cm', mark = true } = {}) {
  const rx = rounded ? 23 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
<defs><linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${MARK_PITCH[0]}"/><stop offset="0.55" stop-color="${MARK_PITCH[1]}"/><stop offset="1" stop-color="${MARK_PITCH[2]}"/></linearGradient>
<radialGradient id="${id}g" cx="0.5" cy="0.35" r="0.65"><stop offset="0" stop-color="#D7FF3A" stop-opacity="0.30"/><stop offset="1" stop-color="#D7FF3A" stop-opacity="0"/></radialGradient></defs>
<rect width="100" height="100" rx="${rx}" fill="url(#${id}p)"/><rect width="100" height="100" rx="${rx}" fill="url(#${id}g)"/>
${mark ? markSvg(id) : ''}</svg>`;
}

/**
 * The mark alone on a transparent square, filling `fill` of it: Android's foreground layer and the splash. With
 * `cutSeam` the whole mark is one flat colour, for Android's one-colour themed icon.
 */
export function markAloneSvg(size: number, fill: number, { color = MARK_VOLT, cutSeam = false } = {}) {
  const inset = (100 - fill * 100) / 2;
  const body = cutSeam ? markSvg('mk', color, undefined, color, color) : markSvg('ma', color);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><g transform="translate(${inset} ${inset}) scale(${fill})">${body}</g></svg>`;
}
