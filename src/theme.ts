import type { BallTone } from './engine/engine.ts';
import { startupPrefs } from './store/prefs.ts';

// "Floodlight": a night match under the lights, cut like a broadcast graphic. Jet black, one volt accent,
// cricket-ball red for wickets, and huge slanted condensed type. "Day match" is the same design for bright sun.

const NIGHT = {
  bg: '#060606',
  surface: '#111111',
  surfaceHi: '#1B1B1B',
  border: 'rgba(255,255,255,0.08)',
  borderHi: 'rgba(255,255,255,0.18)',
  text: '#F4F4EE',
  muted: '#9C9C94',
  faint: '#5F5F59',
  /** Volt: the one accent. Primary actions, sixes, the live state. */
  accent: '#D7FF3A',
  accentDim: 'rgba(215,255,58,0.12)',
  onAccent: '#0A0A0A',
  /** Fours. */
  cyan: '#7FE6FF',
  cyanDim: 'rgba(127,230,255,0.12)',
  /** Trophies and medals. */
  gold: '#FFC93C',
  goldDim: 'rgba(255,201,74,0.12)',
  /** Cricket-ball red: wickets, live dot, destructive. */
  danger: '#FF4B2B',
  dangerDim: 'rgba(255,75,43,0.14)',
  /** Extras. */
  violet: '#B9A6FF',
  violetDim: 'rgba(185,166,255,0.14)',
  /** "r,g,b" of the ink, for faint stripes, ghost words and chart tracks: rgba(${ink}, a). */
  ink: '255,255,255',
  /** A recessed panel inside a card. */
  inset: 'rgba(0,0,0,0.45)',
  scrim: 'rgba(0,0,0,0.75)',
};

// "Day match": for bright sun. Paper white, near-black ink, and the accent deepened to a grass green so it
// still reads as text on white.
const DAY: typeof NIGHT = {
  bg: '#F3F4EE',
  surface: '#FFFFFF',
  surfaceHi: '#ECEEE5',
  border: 'rgba(0,0,0,0.09)',
  borderHi: 'rgba(0,0,0,0.2)',
  text: '#0B0D0A',
  muted: '#4E544A',
  faint: '#82887D',
  accent: '#3B7A00',
  accentDim: 'rgba(59,122,0,0.1)',
  onAccent: '#FFFFFF',
  cyan: '#006E8C',
  cyanDim: 'rgba(0,110,140,0.1)',
  gold: '#9A6A00',
  goldDim: 'rgba(154,106,0,0.12)',
  danger: '#D2241B',
  dangerDim: 'rgba(210,36,27,0.1)',
  violet: '#5A3FCB',
  violetDim: 'rgba(90,63,203,0.1)',
  ink: '0,0,0',
  inset: 'rgba(0,0,0,0.05)',
  scrim: 'rgba(0,0,0,0.45)',
};

export const isDay = startupPrefs.theme === 'day';
export const colors = isDay ? DAY : NIGHT;

/** The ink at a given strength: faint stripes, tracks, ghost words. */
export const ink = (alpha: number) => `rgba(${colors.ink},${alpha})`;

export const gradients = isDay
  ? {
      hero: ['#FFFFFF', '#F7F8F2', '#EEF1E6'] as const,
      accent: ['#4C9400', '#3B7A00'] as const,
      danger: ['#E2342A', '#C61D14'] as const,
      glow: ['rgba(59,122,0,0.1)', 'rgba(59,122,0,0)'] as const,
    }
  : {
      hero: ['#151515', '#0B0B0B', '#060606'] as const,
      accent: ['#E6FF6B', '#C8F51E'] as const,
      danger: ['#FF6A4D', '#FF3B1C'] as const,
      /** Floodlight glow from the top of the screen. */
      glow: ['rgba(215,255,58,0.16)', 'rgba(215,255,58,0)'] as const,
    };

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const ballColors: Record<BallTone, { bg: string; fg: string }> = {
  dot: { bg: colors.surfaceHi, fg: colors.faint },
  run: { bg: ink(0.1), fg: colors.text },
  four: { bg: colors.cyanDim, fg: colors.cyan },
  six: { bg: colors.accent, fg: colors.onAccent },
  wicket: { bg: colors.danger, fg: '#FFFFFF' },
  extra: { bg: colors.violetDim, fg: colors.violet },
};

// Custom fonts carry their weight in the family name; a fontWeight on top makes iOS and Android fall back to the
// system font, so styles pick a family instead of a weight.
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
  /** Scoreboard numbers. */
  score: 'BarlowCondensed_700Bold',
  scoreSemi: 'BarlowCondensed_600SemiBold',
  /** Poster headlines: slanted, heavy, upper case. */
  poster: 'BarlowCondensed_800ExtraBold_Italic',
  posterBlack: 'BarlowCondensed_900Black_Italic',
};

export const type = {
  display: { fontSize: 112, fontFamily: font.posterBlack, letterSpacing: -2, lineHeight: 112, fontVariant: ['tabular-nums' as const] },
  poster: { fontFamily: font.poster, textTransform: 'uppercase' as const, letterSpacing: -0.5 },
  title: { fontSize: 34, fontFamily: font.poster, letterSpacing: -0.5, textTransform: 'uppercase' as const },
  heading: { fontSize: 17, fontFamily: font.bold, letterSpacing: -0.2 },
  body: { fontSize: 15, fontFamily: font.medium },
  label: { fontSize: 11, fontFamily: font.bold, letterSpacing: 1.4, textTransform: 'uppercase' as const },
  num: { fontVariant: ['tabular-nums' as const] },
};
