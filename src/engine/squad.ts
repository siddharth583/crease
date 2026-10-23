import type { Role } from './types.ts';

// The squad: the regulars who turn up every week, whichever side they end up on. Each has a role and a rating
// (1 to 5) for batting, bowling and fielding, used to set them up for an auction. A regular's stats follow
// them by name across every team they play for.

export type Rating = 1 | 2 | 3 | 4 | 5;

export type SquadPlayer = {
  id: string;
  name: string;
  role: Role;
  bat: Rating;
  bowl: Rating;
  field: Rating;
  /** Keeps wicket for whichever side picks them. */
  keeper?: boolean;
};

export const ROLE_LABEL: Record<Role, string> = { bat: 'Batter', bowl: 'Bowler', ar: 'All-rounder', wk: 'Keeper' };

const r = (n: number) => Math.min(5, Math.max(1, Math.round(n))) as Rating;

/** The club's regulars, as first described: who bats, who bowls, who keeps, and how good. */
export const DEFAULT_SQUAD: SquadPlayer[] = (
  [
    { name: 'Siddharth Singh', role: 'ar', bat: 5, bowl: 5, field: 5 },
    { name: 'Anshul Rana', role: 'ar', bat: 4, bowl: 4, field: 4 },
    { name: 'Rishav Bhattacharjee', role: 'ar', bat: 3, bowl: 3, field: 3 },
    { name: 'Nitin Parmar', role: 'bat', bat: 3, bowl: 1, field: 4, keeper: true },
    { name: 'Harleen Singh', role: 'ar', bat: 2, bowl: 4, field: 4 },
    { name: 'Satnoor Singh', role: 'bat', bat: 2, bowl: 1, field: 2 },
    { name: 'Moses Wiliams', role: 'bat', bat: 2, bowl: 1, field: 2 },
    { name: 'Supreet Guleria', role: 'bat', bat: 2, bowl: 1, field: 2 },
    { name: 'Nihal Walia', role: 'wk', bat: 5, bowl: 5, field: 5, keeper: true },
    { name: 'Ashwani Singh', role: 'ar', bat: 4, bowl: 4, field: 4 },
    { name: 'Karandeep Singh', role: 'bowl', bat: 1, bowl: 4, field: 3 },
    { name: 'Navjot Singh', role: 'bat', bat: 3, bowl: 1, field: 3, keeper: true },
    { name: 'Chirag', role: 'ar', bat: 3, bowl: 3, field: 3 },
    { name: 'Charanjeet', role: 'ar', bat: 2, bowl: 2, field: 2 },
    { name: 'Rajeev', role: 'bat', bat: 2, bowl: 1, field: 2 },
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
