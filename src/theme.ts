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
  /** The accent as text or an icon on the page (on night it's the volt itself). */
  accentInk: '#D7FF3A',
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
  /** Mown-grass stripes. */
  stripe: '255,255,255',
  /** A recessed panel inside a card. */
  inset: 'rgba(0,0,0,0.45)',
  scrim: 'rgba(0,0,0,0.75)',
};

// "Day match": the clubhouse in daylight. A soft grey-green ground, white cards that float on a gentle shadow with
// no outlines, the volt kept as a bright fill with black type (deep green when it has to be text), and the
// scoreboards black, like a TV scorebug.
const DAY: typeof NIGHT = {
  bg: '#F1F2EE',
  surface: '#FFFFFF',
  surfaceHi: '#F5F6F2',
  border: 'rgba(17,20,14,0.06)',
  borderHi: 'rgba(17,20,14,0.13)',
  text: '#0F110D',
  muted: '#5F635A',
  faint: '#9A9E94',
  accent: '#D4FF3A',
  accentInk: '#3D7400',
  accentDim: 'rgba(150,200,0,0.14)',
  onAccent: '#0A0A0A',
  cyan: '#00728F',
  cyanDim: 'rgba(0,114,143,0.08)',
  gold: '#A26E00',
  goldDim: 'rgba(196,140,0,0.12)',
  danger: '#E0301E',
  dangerDim: 'rgba(224,48,30,0.08)',
  violet: '#5B3FCB',
  violetDim: 'rgba(91,63,203,0.08)',
  ink: '17,20,14',
  stripe: '17,20,14',
  inset: 'rgba(17,20,14,0.04)',
  scrim: 'rgba(15,17,13,0.4)',
};

export const isDay = startupPrefs.theme === 'day';
export const colors = isDay ? DAY : NIGHT;

/** The black broadcast panels (scoreboards, posters): dark in both themes. */
export const hero = {
  text: NIGHT.text,
  muted: NIGHT.muted,
  faint: NIGHT.faint,
  accent: NIGHT.accent,
  line: NIGHT.borderHi,
  ink: (alpha: number) => `rgba(255,255,255,${alpha})`,
};

/** How day cards sit on the page: no outline, a soft lift. Nothing at night. */
export const edge = isDay
  ? { borderColor: 'rgba(17,20,14,0.05)', boxShadow: '0px 1px 2px rgba(17,20,14,0.04), 0px 8px 24px rgba(17,20,14,0.06)' }
  : {};

/** The ink at a given strength: faint stripes, tracks, ghost words. */
export const ink = (alpha: number) => `rgba(${colors.ink},${alpha})`;

export const gradients = isDay
  ? {
      hero: ['#181818', '#0F0F0F', '#0A0A0A'] as const,
      accent: ['#DBFF4A', '#C2EC10'] as const,
      danger: ['#E2342A', '#C61D14'] as const,
      /** Sunlight falling from the top. */
      glow: ['rgba(212,255,58,0.30)', 'rgba(241,242,238,0)'] as const,
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
