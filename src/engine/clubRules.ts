// How the club plays on the turf, beyond the numbers in HOUSE_RULES: a wide is one run, a no-ball is one run plus
// whatever is hit off it, and there are no byes, no leg byes, no overthrows and no LBW. The scoring screens offer only
// what can happen; a ball scored the other way in an older match still shows, and can still be fixed, as it was.

import type { Extra, WicketKind } from './types.ts';

/** Extras the club doesn't play. */
export const UNUSED_EXTRAS: ReadonlySet<Extra> = new Set<Extra>(['bye', 'legbye']);
/** Ways out the club doesn't play. */
export const UNUSED_WICKETS: ReadonlySet<WicketKind> = new Set<WicketKind>(['lbw']);

/** The options worth showing: the ones the club plays, plus whatever is already chosen. */
export const inPlay = <T extends { value: string }>(options: T[], unused: ReadonlySet<string>, current?: string | null) =>
  options.filter((o) => !unused.has(o.value) || o.value === current);
