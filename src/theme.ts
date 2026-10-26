import type { BallTone } from './engine/engine.ts';
import { startupPrefs } from './store/prefs.ts';

// "Clubhouse": a cricket ground after dark, made calm and clean. A deep pitch-green black, soft rounded surfaces,
// one bright volt accent used sparingly, cricket-ball red for wickets, and Bricolage Grotesque for headlines and
// big numbers. "Day" is the same design on white, for bright sun.

const NIGHT = {
  bg: '#090C0A',
  surface: '#121814',
  surfaceHi: '#1A221C',
  border: 'rgba(214,236,200,0.07)',
  borderHi: 'rgba(214,236,200,0.16)',
  text: '#F1F5EE',
  muted: '#98A396',
  faint: '#5B665C',
  /** Volt: the one accent. Primary actions, sixes, the live state. */
  accent: '#D7FF3A',
  /** The accent as text or an icon on the page (on night it's the volt itself). */
  accentInk: '#D7FF3A',
  accentDim: 'rgba(215,255,58,0.11)',
  onAccent: '#0A0D06',
  /** Fours. */
  cyan: '#7FE6FF',
  cyanDim: 'rgba(127,230,255,0.12)',
  /** Trophies and medals. */
  gold: '#FFCB52',
  goldDim: 'rgba(255,203,82,0.12)',
  /** Cricket-ball red: wickets, live dot, destructive. */
  danger: '#FF5A3C',
  dangerDim: 'rgba(255,90,60,0.14)',
  /** Extras. */
  violet: '#B9A6FF',
  violetDim: 'rgba(185,166,255,0.14)',
  /** "r,g,b" of the ink, for faint tracks and lines: rgba(${ink}, a). */
  ink: '241,245,238',
  /** Mown-grass stripes. */
  stripe: '214,236,200',
  /** A recessed panel inside a card. */
  inset: 'rgba(0,0,0,0.35)',
  scrim: 'rgba(3,5,4,0.72)',
};

// Day: the same clubhouse on white. A soft off-white ground, white cards on a gentle shadow, the volt as a bright
// fill with black type (deep green when it has to be text), and the scoreboards on the dark pitch green.
const DAY: typeof NIGHT = {
  bg: '#F2F3EE',
  surface: '#FFFFFF',
  surfaceHi: '#F1F3EC',
  border: 'rgba(17,24,14,0.07)',
  borderHi: 'rgba(17,24,14,0.14)',
  text: '#0E130D',
  muted: '#5C6358',
  faint: '#99A094',
  accent: '#D4FF3A',
  accentInk: '#3B7200',
  accentDim: 'rgba(130,190,0,0.13)',
  onAccent: '#0A0D06',
  cyan: '#00728F',
  cyanDim: 'rgba(0,114,143,0.08)',
  gold: '#A26E00',
  goldDim: 'rgba(196,140,0,0.12)',
  danger: '#E0301E',
  dangerDim: 'rgba(224,48,30,0.08)',
  violet: '#5B3FCB',
  violetDim: 'rgba(91,63,203,0.08)',
  ink: '14,19,13',
  stripe: '14,19,13',
  inset: 'rgba(14,19,13,0.04)',
  scrim: 'rgba(10,14,9,0.42)',
};

export const isDay = startupPrefs.theme === 'day';
export const colors = isDay ? DAY : NIGHT;

/** The dark pitch-green panels (scoreboards, the home hero): dark in both themes. */
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
  ? { borderColor: 'rgba(14,19,13,0.04)', boxShadow: '0px 1px 2px rgba(14,19,13,0.04), 0px 10px 30px rgba(14,19,13,0.06)' }
  : {};

/** The ink at a given strength: faint stripes, tracks, ghost words. */
export const ink = (alpha: number) => `rgba(${colors.ink},${alpha})`;

/** The pitch at night: the scoreboards and hero panels, the same in both themes. */
const PITCH = ['#1C3324', '#122017', '#0B130D'] as const;
export const HERO_BG = '#0F1A12';

export const gradients = isDay
  ? {
      hero: PITCH,
      accent: ['#DBFF4A', '#C2EC10'] as const,
      danger: ['#E2342A', '#C61D14'] as const,
      /** Morning light over the ground. */
      glow: ['rgba(196,240,90,0.22)', 'rgba(242,243,238,0)'] as const,
    }
  : {
      hero: PITCH,
      accent: ['#E6FF6B', '#C8F51E'] as const,
      danger: ['#FF6A4D', '#FF3B1C'] as const,
      /** The floodlights' green haze at the top of the screen. */
      glow: ['rgba(80,140,70,0.20)', 'rgba(9,12,10,0)'] as const,
    };

export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 };
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
  score: 'BricolageGrotesque_700Bold',
  scoreSemi: 'BricolageGrotesque_600SemiBold',
  /** Headlines and big figures. */
  poster: 'BricolageGrotesque_700Bold',
  posterBlack: 'BricolageGrotesque_800ExtraBold',
};

export const type = {
  display: { fontSize: 104, fontFamily: font.posterBlack, letterSpacing: -4, lineHeight: 108, fontVariant: ['tabular-nums' as const] },
  poster: { fontFamily: font.poster, letterSpacing: -0.5 },
  title: { fontSize: 30, fontFamily: font.posterBlack, letterSpacing: -0.8 },
  heading: { fontSize: 17, fontFamily: font.bold, letterSpacing: -0.2 },
  body: { fontSize: 15, fontFamily: font.medium },
  label: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1.1, textTransform: 'uppercase' as const },
  num: { fontVariant: ['tabular-nums' as const] },
};
