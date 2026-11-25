import type { BallTone } from './engine/engine.ts';
import { startupPrefs } from './store/prefs.ts';

// "Pavilion": a cricket ground after dark. Deep outfield green, cricket whites for the type, the original volt green for what
// you can act on, leather red for wickets and the live dot, champagne brass for honours. Bricolage Grotesque for headlines and big numbers, like a scoreboard. "Day" is the same on warm paper.

const NIGHT = {
  bg: '#050D09',
  surface: '#0B1711',
  surfaceHi: '#13241A',
  border: 'rgba(205,235,215,0.075)',
  borderHi: 'rgba(205,235,215,0.17)',
  /** Cricket whites, a touch warm. */
  text: '#F4F1E6',
  muted: '#94AB9D',
  /** Small print: raised so it still reads at a glance (4.5:1 on the cards). */
  faint: '#7A9384',
  /** Mown grass: the one accent. Primary actions, sixes, selected, the good news. */
  accent: '#D7FF3A',
  /** The accent as text or an icon on the page. */
  accentInk: '#D7FF3A',
  accentDim: 'rgba(215,255,58,0.11)',
  onAccent: '#0A0D06',
  /** Fours. */
  cyan: '#6CCFF0',
  cyanDim: 'rgba(108,207,240,0.13)',
  /** Trophies and medals: brass, like an honours board. */
  gold: '#DDB66E',
  goldDim: 'rgba(221,182,110,0.14)',
  /** Leather red: wickets, the live dot, destructive. */
  danger: '#E5485D',
  dangerDim: 'rgba(229,72,93,0.15)',
  /** Extras. */
  violet: '#B4A2FF',
  violetDim: 'rgba(180,162,255,0.15)',
  /** "r,g,b" of the ink, for faint tracks and lines: rgba(${ink}, a). */
  ink: '244,241,230',
  /** Mown-grass stripes. */
  stripe: '200,235,205',
  /** A recessed panel inside a card. */
  inset: 'rgba(0,0,0,0.38)',
  scrim: 'rgba(2,7,4,0.76)',
};

// Day: the same Pavilion on warm paper. White cards on a gentle shadow, the grass green as a fill with dark type
// (a deep green when it has to be text), and the scoreboards on the dark outfield panel.
const DAY: typeof NIGHT = {
  bg: '#F4F2EA',
  surface: '#FFFFFF',
  surfaceHi: '#ECEEE4',
  border: 'rgba(14,30,18,0.08)',
  borderHi: 'rgba(14,30,18,0.16)',
  text: '#0F1A13',
  muted: '#566A5C',
  faint: '#69806F',
  accent: '#D4FF3A',
  accentInk: '#3B7200',
  accentDim: 'rgba(130,190,0,0.13)',
  onAccent: '#0A0D06',
  cyan: '#007A9E',
  cyanDim: 'rgba(0,122,158,0.08)',
  gold: '#8F6A1F',
  goldDim: 'rgba(196,140,0,0.12)',
  danger: '#C9283E',
  dangerDim: 'rgba(216,39,61,0.08)',
  violet: '#5B3FCB',
  violetDim: 'rgba(91,63,203,0.08)',
  ink: '15,26,19',
  stripe: '15,26,19',
  inset: 'rgba(15,26,19,0.04)',
  scrim: 'rgba(8,16,10,0.44)',
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

/**
 * Frosted glass for a card that sits on a dark ground panel (scores, stats, the Man of the Match): the ground shows
 * through, blurred, with a light edge and a soft top highlight. Web blurs; native falls back to the tinted pane.
 */
export const glass = {
  backgroundColor: 'rgba(10,22,15,0.28)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.14)',
  backdropFilter: 'blur(16px) saturate(140%)',
  WebkitBackdropFilter: 'blur(16px) saturate(140%)',
  boxShadow: 'inset 0px 1px 0px rgba(255,255,255,0.16), 0px 10px 28px rgba(0,0,0,0.22)',
} as object;

/** How day cards sit on the page: no outline, a soft lift. Nothing at night. */
export const edge = isDay
  ? { borderColor: 'rgba(14,19,13,0.04)', boxShadow: '0px 1px 2px rgba(14,19,13,0.04), 0px 10px 30px rgba(14,19,13,0.06)' }
  : {};

/** The ink at a given strength: faint stripes, tracks, ghost words. */
export const ink = (alpha: number) => `rgba(${colors.ink},${alpha})`;

/** The pitch at night: the scoreboards and hero panels, the same in both themes. */
const PITCH = ['#17402B', '#0D2418', '#07120C'] as const;
export const HERO_BG = '#0B1A12';

export const gradients = isDay
  ? {
      hero: PITCH,
      accent: ['#DBFF4A', '#C2EC10'] as const,
      danger: ['#EE4A5E', '#CC2A40'] as const,
      /** Morning light over the ground. */
      glow: ['rgba(60,190,130,0.24)', 'rgba(244,242,234,0)'] as const,
    }
  : {
      hero: PITCH,
      accent: ['#E6FF6B', '#C8F51E'] as const,
      danger: ['#FF6477', '#EC3A50'] as const,
      /** The floodlights' green haze at the top of the screen. */
      glow: ['rgba(40,170,115,0.24)', 'rgba(5,13,9,0)'] as const,
    };

export const radius = { sm: 12, md: 16, lg: 22, xl: 30, pill: 999 };
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
    glow: [tint(rgb, isDay ? 0.22 : 0.2), isDay ? 'rgba(244,242,234,0)' : 'rgba(5,13,9,0)'],
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
