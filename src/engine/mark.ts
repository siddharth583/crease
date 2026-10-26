// The Crease mark, in one place: the app icon, the logo in the app and the logo on reports are all drawn from it.
// "Bowled": three stumps on the crease, the middle one knocked back, both bails flying, the ball through.

export const MARK_VOLT = '#D7FF3A';
/** The icon's background, top to bottom: the pitch at night. */
export const MARK_PITCH = ['#1C3324', '#122017', '#0B130D'] as const;
/** How much of the icon's square the mark fills. */
export const MARK_SCALE = 0.74;

export type MarkShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number; rotate?: [number, number, number] }
  | { kind: 'circle'; cx: number; cy: number; r: number };

/** The shapes on a 100-unit square. */
export const MARK: MarkShape[] = [
  { kind: 'rect', x: 25, y: 32, w: 7.5, h: 46, r: 3.75 },
  { kind: 'rect', x: 46.25, y: 32, w: 7.5, h: 46, r: 3.75, rotate: [14, 50, 78] },
  { kind: 'rect', x: 67.5, y: 32, w: 7.5, h: 46, r: 3.75 },
  { kind: 'rect', x: 30, y: 15, w: 15, h: 5.5, r: 2.75, rotate: [-24, 37.5, 17.75] },
  { kind: 'rect', x: 56, y: 8, w: 15, h: 5.5, r: 2.75, rotate: [32, 63.5, 10.75] },
  { kind: 'circle', cx: 86, cy: 54, r: 8 },
  { kind: 'rect', x: 10, y: 84, w: 80, h: 5.5, r: 2.75 },
];

/** The shapes as SVG markup, in one colour. */
export const markShapesSvg = (color = MARK_VOLT) =>
  MARK.map((s) =>
    s.kind === 'circle'
      ? `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${color}"/>`
      : `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${color}"${s.rotate ? ` transform="rotate(${s.rotate.join(' ')})"` : ''}/>`,
  ).join('');

/**
 * The whole icon as an SVG: the pitch background with its glow and the mark. `rounded` gives it the corners of an app
 * icon on a phone (for logos drawn in the app and on reports); the icon files themselves stay square.
 */
export function appIconSvg(size: number, { rounded = true, id = 'cm' } = {}) {
  const inset = (100 * (1 - MARK_SCALE)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
<defs><linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${MARK_PITCH[0]}"/><stop offset="0.55" stop-color="${MARK_PITCH[1]}"/><stop offset="1" stop-color="${MARK_PITCH[2]}"/></linearGradient>
<radialGradient id="${id}g" cx="0.5" cy="0.45" r="0.55"><stop offset="0" stop-color="${MARK_VOLT}" stop-opacity="0.16"/><stop offset="1" stop-color="${MARK_VOLT}" stop-opacity="0"/></radialGradient></defs>
<rect width="100" height="100" rx="${rounded ? 23 : 0}" fill="url(#${id}p)"/><rect width="100" height="100" rx="${rounded ? 23 : 0}" fill="url(#${id}g)"/>
<g transform="translate(${inset} ${inset}) scale(${MARK_SCALE})">${markShapesSvg()}</g></svg>`;
}
