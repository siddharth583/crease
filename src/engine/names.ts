// Names as they're typed: the players Crease already knows that the typing could mean, so the same person isn't
// entered twice under two spellings ("Mahika" and "Mahika Kaushik") and their stats stay in one place.

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** One letter different (added, missing, changed or two swapped): "Ashwni" for "Ashwani". */
function nearly(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return a === b;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const rest = (x: string, y: string) => x.slice(i + 1) === y.slice(i + 1);
  if (a.length === b.length) return rest(a, b) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * The known names the typing could mean, best first: names that start with it, then names with a word that starts
 * with it ("rana" → Anshul Rana), then near misses of a first name ("ashwni" → Ashwani Singh). Nothing until two
 * letters are typed, nothing when it's already a known name spelt exactly so, and never a name in `taken`.
 * `known` is in order of preference (the squad, then the most played).
 */
export function suggestNames(typed: string, known: string[], taken: string[] = [], limit = 4): string[] {
  const q = key(typed);
  if (q.length < 2) return [];
  const exact = known.find((n) => key(n) === q);
  if (exact && exact.trim() === typed.trim()) return [];
  const skip = new Set(taken.map(key));
  const seen = new Set<string>();
  const ranked: { name: string; rank: number; at: number }[] = [];
  known.forEach((name, at) => {
    const k = key(name);
    if (!k || seen.has(k) || skip.has(k)) return;
    seen.add(k);
    const words = k.split(' ');
    const rank = k === q ? 0 : k.startsWith(q) ? 1 : words.some((w) => w.startsWith(q)) ? 2 : q.length >= 4 && !q.includes(' ') && words.some((w) => nearly(w.slice(0, Math.max(q.length, w.length)), q)) ? 3 : -1;
    if (rank >= 0) ranked.push({ name: name.trim(), rank, at });
  });
  return ranked
    .sort((a, b) => a.rank - b.rank || a.at - b.at)
    .slice(0, limit)
    .map((x) => x.name);
}

/**
 * Every name Crease knows, the squad's first and then the rest by how many matches they're in: each person once,
 * spelt as the squad (or, outside it, as most often) has them. Placeholders like "Player 3" aren't names.
 */
export function knownNames(squad: string[], matchNames: string[][]): string[] {
  const placeholder = (n: string) => /^player \d+$/i.test(n.trim());
  const count = new Map<string, { name: string; n: number }>();
  for (const names of matchNames) {
    for (const k of new Set(names.filter((n) => n.trim() && !placeholder(n)).map(key))) {
      const spelt = names.find((n) => key(n) === k)!.trim();
      const c = count.get(k);
      count.set(k, { name: c?.name ?? spelt, n: (c?.n ?? 0) + 1 });
    }
  }
  const inSquad = new Set(squad.map(key));
  // A first name alone that only one squad player has is that player ("Mahika" is Mahika Kaushik), not someone else.
  const firsts = squad.map((n) => key(n).split(' ')[0]);
  const isSquadFirstName = (k: string) => !k.includes(' ') && firsts.filter((f) => f === k).length === 1 && !inSquad.has(k);
  const rest = [...count.entries()]
    .filter(([k]) => !inSquad.has(k) && !isSquadFirstName(k))
    .sort((a, b) => b[1].n - a[1].n)
    .map(([, c]) => c.name);
  return [...squad.map((n) => n.trim()).filter(Boolean), ...rest];
}
