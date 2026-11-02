import type { Match } from './types.ts';

// Keeping one phone and the club's database in step. Pure decisions only: given what's on the phone, what's in the
// club, and what the two last agreed on, say what to send and what to take. The Firebase side does the sending.

/** A short fingerprint of a saved thing, to tell whether it changed since the phone and the club last agreed. */
export function fingerprint(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}.${text.length}`;
}

/** A match as the club keeps it: the whole match as text, or a mark that it was deleted. */
export type RemoteMatch = { json?: string; deleted?: boolean; updatedAt: number };

export type MatchPlan = {
  /** The club's copy is newer, or the phone hasn't got it: take it. */
  take: Match[];
  /** The phone's copy is newer, or the club hasn't got it: send it. */
  send: Match[];
  /** Deleted in the club: delete here. */
  remove: string[];
  /** Deleted on this phone since the last sync: mark it deleted in the club. */
  bury: string[];
  /** What the phone and the club now agree on, by match id. */
  agreed: Record<string, string>;
};

const when = (m: Match) => m.updatedAt ?? m.createdAt;

/**
 * Matches both ways. Each match on its own: the newer copy wins (a fix, a picked Man of the Match, more balls). A
 * match the phone knew from the club but no longer has was deleted here; one the club marks deleted goes here too.
 */
export function planMatches(local: Match[], remote: Map<string, RemoteMatch>, last: Record<string, string>): MatchPlan {
  const plan: MatchPlan = { take: [], send: [], remove: [], bury: [], agreed: {} };
  const mine = new Map(local.map((m) => [m.id, m]));
  for (const [id, r] of remote) {
    const m = mine.get(id);
    if (r.deleted) {
      if (m && when(m) > r.updatedAt) plan.send.push(m);
      else if (m) plan.remove.push(id);
      continue;
    }
    if (!r.json) continue;
    if (!m) {
      // Synced before and gone from the phone: deleted here. Never seen: new from the club.
      if (last[id]) plan.bury.push(id);
      else {
        plan.take.push(JSON.parse(r.json) as Match);
        plan.agreed[id] = fingerprint(r.json);
      }
      continue;
    }
    const text = JSON.stringify(m);
    if (text === r.json) {
      plan.agreed[id] = fingerprint(text);
      continue;
    }
    if (r.updatedAt > when(m)) {
      plan.take.push(JSON.parse(r.json) as Match);
      plan.agreed[id] = fingerprint(r.json);
    } else plan.send.push(m);
  }
  for (const m of local) if (!remote.has(m.id)) plan.send.push(m);
  return plan;
}

/**
 * One shared thing that isn't per match (the squad, the saved sides, auctions, line-ups), as a whole. Whichever side
 * changed since the two last agreed wins; if both did, or this phone has never synced it, the club's copy wins, so a
 * phone joining takes the club's squad rather than overwriting it.
 */
export function planShared(local: string, remote: string | null, last: string | undefined): 'send' | 'take' | 'none' {
  if (remote === null) return 'send';
  if (local === remote) return 'none';
  if (last === undefined) return 'take';
  if (fingerprint(local) === last) return 'take';
  if (fingerprint(remote) === last) return 'send';
  return 'take';
}
