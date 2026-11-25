// The club's two sides have a badge of their own: Thunder (Copan Strikers), a bolt on an electric-blue shield, and Royal
// (Copan Royals), a crown on a royal-purple one. Any other side gets the initials badge from its name instead.

const SHIELD = 'M50 4 L90 17 V49 C90 75 71 91 50 97 C29 91 10 75 10 49 V17 Z';
const INNER = 'M50 11 L83 22 V49 C83 70 68 84 50 90 C32 84 17 70 17 49 V22 Z';

/** A side's own logo as an SVG, or null when it has none. `id` keeps gradients apart when several share a page. */
export function teamLogoSvg(name: string, size: number, id = 'tl'): string | null {
  const key = name.trim().toLowerCase();
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">`;
  if (key === 'copan strikers')
    return `${open}<defs>
<linearGradient id="${id}b" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#58C8FF"/><stop offset="0.5" stop-color="#1D5FA8"/><stop offset="1" stop-color="#0A1F40"/></linearGradient>
<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#BDEBFF"/></linearGradient>
<radialGradient id="${id}g" cx="0.5" cy="0.45" r="0.5"><stop offset="0" stop-color="#7FE0FF" stop-opacity="0.55"/><stop offset="1" stop-color="#7FE0FF" stop-opacity="0"/></radialGradient></defs>
<path d="${SHIELD}" fill="url(#${id}b)"/><path d="${INNER}" fill="none" stroke="#A8E6FF" stroke-opacity="0.55" stroke-width="1.6"/>
<circle cx="50" cy="48" r="34" fill="url(#${id}g)"/>
<path d="M60 13 L28 56 H47 L39 88 L73 41 H54 L66 13 Z" fill="url(#${id}f)" stroke="#0A1F40" stroke-opacity="0.35" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M22 30 L30 34 M20 44 L27 45 M78 62 L70 60 M80 48 L73 49" stroke="#BDEBFF" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/></svg>`;
  if (key === 'copan royals')
    return `${open}<defs>
<linearGradient id="${id}b" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#8A4FD8"/><stop offset="0.5" stop-color="#43226F"/><stop offset="1" stop-color="#150A28"/></linearGradient>
<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9A0"/><stop offset="0.6" stop-color="#FFC940"/><stop offset="1" stop-color="#D08A0A"/></linearGradient>
<radialGradient id="${id}g" cx="0.5" cy="0.45" r="0.5"><stop offset="0" stop-color="#FFD56B" stop-opacity="0.4"/><stop offset="1" stop-color="#FFD56B" stop-opacity="0"/></radialGradient></defs>
<path d="${SHIELD}" fill="url(#${id}b)"/><path d="${INNER}" fill="none" stroke="#FFD56B" stroke-opacity="0.7" stroke-width="1.6"/>
<circle cx="50" cy="50" r="34" fill="url(#${id}g)"/>
<path d="M26 69 L21 34 L38 50 L50 26 L62 50 L79 34 L74 69 Z" fill="url(#${id}f)" stroke="#150A28" stroke-opacity="0.35" stroke-width="1.2" stroke-linejoin="round"/>
<rect x="26" y="68" width="48" height="10" rx="3.5" fill="url(#${id}f)" stroke="#150A28" stroke-opacity="0.35" stroke-width="1.2"/>
<circle cx="21" cy="32" r="4" fill="#FFF6D6"/><circle cx="50" cy="24" r="4.4" fill="#FFF6D6"/><circle cx="79" cy="32" r="4" fill="#FFF6D6"/>
<circle cx="38" cy="73.5" r="1.8" fill="#43226F"/><circle cx="50" cy="73.5" r="1.8" fill="#43226F"/><circle cx="62" cy="73.5" r="1.8" fill="#43226F"/></svg>`;
  return null;
}
