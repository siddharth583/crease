import { File, Paths } from 'expo-file-system';
import { createContext, createElement, useCallback, useContext, useState, type ReactNode } from 'react';
import { reloadAppAsync } from 'expo';
import { DevSettings, Platform } from 'react-native';

// Per-phone preferences. Read synchronously at start-up, because the colour theme has to be known before any
// screen's styles are created.

export type Prefs = {
  theme: 'night' | 'day';
  /** When the last full backup was exported (ms), for the reminder. */
  lastBackup: number | null;
};

const DEFAULTS: Prefs = { theme: 'night', lastBackup: null };
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

/**
 * Switch theme now. Every screen's colours are fixed when the app starts (that keeps scrolling and scoring fast),
 * so the app saves the choice and reloads itself straight away: a blink, with every match still there.
 */
export function applyTheme(theme: Prefs['theme']) {
  write({ ...read(), theme });
  if (Platform.OS === 'web') {
    window.location.reload();
    return;
  }
  reloadAppAsync('Theme changed').catch(() => {
    if (__DEV__) DevSettings.reload();
  });
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
