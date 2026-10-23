import type { Role, Team } from './types.ts';

// The squad: the regulars who turn up every week, whichever side they end up on. Each has a role and a rating
// (1 to 5) for batting, bowling and fielding, used to set them up for an auction. A regular's stats follow
// them by name across every team they play for.

export type Rating = 1 | 2 | 3 | 4 | 5;

/** The auction's price bands: each has its own base price. */
export type Category = 'ar' | 'bat' | 'bowl' | 'other';

export type SquadPlayer = {
  id: string;
  name: string;
  role: Role;
  bat: Rating;
  bowl: Rating;
  field: Rating;
  /** Keeps wicket for whichever side picks them. */
  keeper?: boolean;
  /** Price band in the auction; worked out from the role when not set. */
  category?: Category;
};

export const ROLE_LABEL: Record<Role, string> = { bat: 'Batter', bowl: 'Bowler', ar: 'All-rounder', wk: 'Keeper' };

export const CATEGORIES: Category[] = ['ar', 'bat', 'bowl', 'other'];
export const CATEGORY_LABEL: Record<Category, string> = { ar: 'AR', bat: 'BAT', bowl: 'BOW', other: 'Other' };
export const CATEGORY_NAME: Record<Category, string> = { ar: 'All-rounders', bat: 'Batters', bowl: 'Bowlers', other: 'Others' };

/** A player's price band: as set, or from their role (a keeper who also bowls is an all-rounder). */
export function categoryOf(p: Pick<SquadPlayer, 'role' | 'bowl' | 'category'>): Category {
  if (p.category) return p.category;
  if (p.role === 'wk') return p.bowl >= 3 ? 'ar' : 'bat';
  return p.role;
}

const r = (n: number) => Math.min(5, Math.max(1, Math.round(n))) as Rating;

/** The club's regulars, as first described: who bats, who bowls, who keeps, and how good. */
export const DEFAULT_SQUAD: SquadPlayer[] = (
  [
    { name: 'Siddharth Singh', role: 'ar', bat: 5, bowl: 5, field: 5 },
    { name: 'Anshul Rana', role: 'ar', bat: 4, bowl: 4, field: 4 },
    { name: 'Rishav Bhattacharjee', role: 'ar', bat: 3, bowl: 3, field: 3 },
    { name: 'Nitin Parmar', role: 'bat', bat: 3, bowl: 1, field: 4, keeper: true },
    { name: 'Harleen Singh', role: 'ar', bat: 2, bowl: 4, field: 4 },
    { name: 'Satnoor Singh', role: 'bat', bat: 2, bowl: 1, field: 2, category: 'other' },
    { name: 'Moses Wiliams', role: 'bat', bat: 2, bowl: 1, field: 2, category: 'other' },
    { name: 'Supreet Guleria', role: 'bat', bat: 2, bowl: 1, field: 2, category: 'other' },
    { name: 'Nihal Walia', role: 'wk', bat: 5, bowl: 5, field: 5, keeper: true },
    { name: 'Ashwani Singh', role: 'ar', bat: 4, bowl: 4, field: 4 },
    { name: 'Karandeep Singh', role: 'bowl', bat: 1, bowl: 4, field: 3 },
    { name: 'Navjot Singh', role: 'bat', bat: 3, bowl: 1, field: 3, keeper: true },
    { name: 'Chirag', role: 'ar', bat: 3, bowl: 3, field: 3 },
    { name: 'Charanjeet', role: 'ar', bat: 2, bowl: 2, field: 2, category: 'other' },
    { name: 'Rajeev', role: 'bat', bat: 2, bowl: 1, field: 2, category: 'other' },
    { name: 'Rohit', role: 'bowl', bat: 1, bowl: 3, field: 2 },
  ] as (Omit<SquadPlayer, 'id' | 'bat' | 'bowl' | 'field'> & { bat: number; bowl: number; field: number })[]
).map((p, i) => ({
  ...p,
  id: `regular-${i + 1}`,
  bat: r(p.bat),
  bowl: r(p.bowl),
  field: r(p.field),
}));

/** One number for how good a player is overall: their best suit counts most. */
export function overall(p: Pick<SquadPlayer, 'bat' | 'bowl' | 'field'>): number {
  const [best, second] = [p.bat, p.bowl].sort((a, b) => b - a);
  return Math.round((best * 0.6 + second * 0.25 + p.field * 0.15) * 10) / 10;
}

/** The club's two usual sides, for a phone that has none saved yet: the first eight regulars and the last eight. */
export const DEFAULT_TEAMS: Team[] = [
  { id: 'copan-a', name: 'Copan A', players: DEFAULT_SQUAD.slice(0, 8).map((p, i) => ({ id: `copan-a-p${i + 1}`, name: p.name, role: p.role })) },
  { id: 'copan-b', name: 'Copan B', players: DEFAULT_SQUAD.slice(8).map((p, i) => ({ id: `copan-b-p${i + 1}`, name: p.name, role: p.role })) },
];
