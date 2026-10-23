import { File, Paths } from 'expo-file-system';
import { createContext, createElement, useCallback, useContext, useState, type ReactNode } from 'react';
import { DevSettings, Platform } from 'react-native';

// Per-phone preferences. Read synchronously at start-up, because the colour theme has to be known before any
// screen's styles are created.

export type Language = 'en' | 'hi';
export type Prefs = {
  theme: 'night' | 'day';
  bigKeys: boolean;
  leftHanded: boolean;
  language: Language;
  /** The first-time scoring tips have been shown. */
  guideSeen: boolean;
  /** When the last full backup was exported (ms), for the reminder. */
  lastBackup: number | null;
};

const DEFAULTS: Prefs = { theme: 'night', bigKeys: false, leftHanded: false, language: 'en', guideSeen: false, lastBackup: null };
const KEY = 'crease.prefs.v1';

function prefsFile() {
  return new File(Paths.document, 'crease-prefs.json');
}

function read(): Prefs {
  try {
    const raw =
      Platform.OS === 'web'
        ? typeof localStorage !== 'undefined'
          ? localStorage.getItem(KEY)
          : null
        : prefsFile().exists
          ? prefsFile().textSync()
          : null;
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function write(p: Prefs) {
  try {
    const raw = JSON.stringify(p);
    if (Platform.OS === 'web') localStorage.setItem(KEY, raw);
    else {
      const f = prefsFile();
      if (!f.exists) f.create();
      f.writeSync(raw);
    }
  } catch {
    // Preferences are a convenience; losing one is not worth an error.
  }
}

/** As saved when the app started. The theme only ever comes from here. */
export const startupPrefs: Prefs = read();

/** Restart so a new theme applies everywhere. Returns false where the app can't restart itself. */
export function restartApp(): boolean {
  if (Platform.OS === 'web') {
    window.location.reload();
    return true;
  }
  if (__DEV__) {
    DevSettings.reload();
    return true;
  }
  return false;
}

type PrefsStore = { prefs: Prefs; setPrefs: (patch: Partial<Prefs>) => void };
const PrefsContext = createContext<PrefsStore | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, set] = useState<Prefs>(startupPrefs);
  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    set((p) => {
      const next = { ...p, ...patch };
      write(next);
      return next;
    });
  }, []);
  return createElement(PrefsContext.Provider, { value: { prefs, setPrefs } }, children);
}

export function usePrefs(): PrefsStore {
  const store = useContext(PrefsContext);
  if (!store) throw new Error('usePrefs must be used inside PrefsProvider');
  return store;
}
