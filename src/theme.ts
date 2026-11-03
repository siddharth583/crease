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
  /** Small print: raised so it still reads at a glance (4.5:1 on the cards). */
  faint: '#7A867B',
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
  /** Small print: dark enough to read in the sun (4.5:1 on white). */
  faint: '#6E7569',
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
  cyan: NIGHT.cyan,
  gold: NIGHT.gold,
  violet: NIGHT.violet,
  line: NIGHT.borderHi,
  ink: (alpha: number) => `rgba(255,255,255,${alpha})`,
  /** A recessed strip on a dark panel (the stats under a name): darker than the panel in either theme. */
  inset: 'rgba(0,0,0,0.32)',
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
  display: { fontSize: 104, fontFamily: font.posterBlack, letterSpacing: -4, lineHeight: 114, fontVariant: ['tabular-nums' as const] },
  poster: { fontFamily: font.poster, letterSpacing: -0.5 },
  title: { fontSize: 30, fontFamily: font.posterBlack, letterSpacing: -0.8 },
  heading: { fontSize: 17, fontFamily: font.bold, letterSpacing: -0.2 },
  body: { fontSize: 15, fontFamily: font.medium },
  label: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1.1, textTransform: 'uppercase' as const },
  num: { fontVariant: ['tabular-nums' as const] },
};

/**
 * A side's own theme, apart from the app's volt and green, worn by its whole page: the panel's gradient, the haze at
 * the top, the cards and their edges, and every highlight. `ink` is the accent as text, readable in day or night.
 */
export type TeamTheme = {
  label: string;
  accent: string;
  onAccent: string;
  ink: string;
  hero: readonly [string, string, string];
  soft: string;
  glow: readonly [string, string];
  card: string;
  line: string;
};
const tint = (rgb: string, a: number) => `rgba(${rgb},${a})`;
function theme(label: string, accent: string, rgb: string, onAccent: string, ink: [day: string, night: string], hero: TeamTheme['hero'], card: [day: string, night: string]): TeamTheme {
  return {
    label,
    accent,
    onAccent,
    ink: isDay ? ink[0] : ink[1],
    hero,
    soft: tint(rgb, 0.16),
    glow: [tint(rgb, isDay ? 0.22 : 0.2), isDay ? 'rgba(242,243,238,0)' : 'rgba(9,12,10,0)'],
    card: isDay ? card[0] : card[1],
    line: tint(rgb, isDay ? 0.35 : 0.22),
  };
}
const TEAM_THEMES: Record<string, TeamTheme> = {
  /** Thunder: electric blue lightning in a slate storm. */
  'copan strikers': theme('Thunder', '#4FC3FF', '79,195,255', '#04121C', ['#1A6FA6', '#7FD3FF'], ['#24344F', '#162238', '#0B121F'], ['#F4F9FD', '#111A27']),
  /** Royal: gold on royal purple. */
  'copan royals': theme('Royal', '#FFC940', '255,201,64', '#1A1302', ['#8A5E00', '#FFD56B'], ['#3D2066', '#281445', '#160B28'], ['#FBF7EE', '#1A1226']),
};
/** A side's own theme, if it has one. */
export const ownTeamTheme = (name?: string | null): TeamTheme | undefined => TEAM_THEMES[(name ?? '').trim().toLowerCase()];
/** A side's own theme; any other side (a one-off XI) plays in the app's own. */
export const teamTheme = (name?: string | null): TeamTheme =>
  ownTeamTheme(name) ?? {
    label: 'Crease',
    accent: colors.accent,
    onAccent: colors.onAccent,
    ink: colors.accentInk,
    hero: PITCH,
    soft: colors.accentDim,
    glow: gradients.glow,
    card: colors.surface,
    line: colors.border,
  };
