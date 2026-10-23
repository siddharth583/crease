import type { Match, Team } from '../engine/types.ts';

// Talks to the club functions in supabase/schema.sql over Supabase's REST API. Set in .env (see .env.example).
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const cloudConfigured = Boolean(URL && KEY);

export type Club = { code: string; name: string };
export type RemoteMatch = { id: string; data: Match; deleted: boolean };
export type Pulled = { now: string; matches: RemoteMatch[]; teams: Team[] };

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: KEY };
  // Legacy anon keys are JWTs and go in Authorization too; new publishable keys go in apikey only.
  if (KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`;
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${fn} failed (${res.status}) ${text}`.trim());
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// No 0/O or 1/I/L, so a code read out loud at the ground can't be misheard.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newClubCode() {
  const pick = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return Array.from({ length: 8 }, pick).join('');
}

/** Codes are stored without the dash; people may type it, spaces, or lower case. */
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

export const createClub = (name: string) => rpc<Club>('club_create', { p_code: newClubCode(), p_name: name });
export const findClub = (code: string) => rpc<Club | null>('club_info', { p_code: normalizeCode(code) });
export const pull = (code: string, since: string) => rpc<Pulled | null>('club_pull', { p_code: code, p_since: since });
export const push = (code: string, matches: RemoteMatch[], teams: Team[]) =>
  rpc<void>('club_push', { p_code: code, p_matches: matches, p_teams: teams });
