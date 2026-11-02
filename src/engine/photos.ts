import { displayName } from './stats.ts';

// Players' photos: small square JPEGs as data URLs, kept by name so a photo follows the player everywhere they appear.
// They live on the phone and in the club's database, never in the app's code.

export type Photos = Record<string, string>;

/** The key a photo is kept under: the player's full name, any case ("Ajayvir" is Ajayvir Singh Ghai). */
export const photoKey = (name: string) => displayName(name).trim().replace(/\s+/g, ' ').toLowerCase();

export const photoFor = (photos: Photos, name: string | undefined | null): string | undefined => (name ? photos[photoKey(name)] : undefined);

const isPhoto = (v: unknown): v is string => typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);

/** A photos file ({crease: 'photos', photos: {name: dataUrl}}): its photos by key, or null if it isn't one. */
export function parsePhotos(text: string): Photos | null {
  try {
    const data = JSON.parse(text) as { crease?: string; photos?: Record<string, unknown> };
    if (data?.crease !== 'photos' || !data.photos || typeof data.photos !== 'object') return null;
    const out: Photos = {};
    for (const [name, url] of Object.entries(data.photos)) if (name.trim() && isPhoto(url)) out[photoKey(name)] = url;
    return out;
  } catch {
    return null;
  }
}
