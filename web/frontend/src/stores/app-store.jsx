/**
 * InkDrop Signal Store — tiny reactive state using Preact signals pattern
 * No external dependency; uses simple pub/sub for state management.
 */

import { useState, useEffect } from 'preact/hooks';

const subscribers = new Map();
let nextId = 0;

function subscribe(fn) {
  const id = ++nextId;
  subscribers.set(id, fn);
  return () => subscribers.delete(id);
}

function notify() {
  for (const fn of subscribers.values()) fn();
}

function createStore(initialState) {
  const state = { ...initialState };
  const listeners = new Map();
  let lid = 0;

  function get(key) {
    return state[key];
  }

  function set(key, value) {
    if (state[key] !== value) {
      state[key] = value;
      const keyListeners = listeners.get(key);
      if (keyListeners) {
        for (const fn of keyListeners.values()) fn(value, state);
      }
      notify();
    }
  }

  function setMany(updates) {
    let changed = false;
    for (const [k, v] of Object.entries(updates)) {
      if (state[k] !== v) {
        state[k] = v;
        changed = true;
        const keyListeners = listeners.get(k);
        if (keyListeners) {
          for (const fn of keyListeners.values()) fn(v, state);
        }
      }
    }
    if (changed) notify();
  }

  function subscribeKey(key, fn) {
    if (!listeners.has(key)) listeners.set(key, new Map());
    const id = ++lid;
    listeners.get(key).set(id, fn);
    return () => {
      const m = listeners.get(key);
      if (m) m.delete(id);
    };
  }

  function snapshot() {
    return { ...state };
  }

  return { get, set, setMany, subscribeKey, snapshot };
}

// ── Global App Store ────────────────────────────────────────────────────
export const appStore = createStore({
  // Auth
  authStatus: null,
  principal: null,
  authReady: false,
  authenticated: false,
  administrator: false,
  setupRequired: false,
  bootstrapRequired: false,
  // Navigation
  currentSection: 'series',
  currentSubsection: null,
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  // State data
  sectionsData: null,
  viewData: null,
  viewLoading: false,
  viewError: null,
  // Toasts
  toasts: [],
  // Version
  versionInfo: null,
});

// ── Preferences Store (persisted to localStorage) ────────────────────────
const PREF_KEY = 'inkdrop.preferences.v1';
const prefDefaults = {
  tableDensity: 'comfortable',
  tableThumbnails: true,
  tableDetails: false,
  tablePageSize: 50,
  calendarWindow: 30,
};

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    return { ...prefDefaults, ...saved };
  } catch {
    return { ...prefDefaults };
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

export const prefStore = createStore(loadPrefs());

const origSetMany = prefStore.setMany;
prefStore.setMany = function (updates) {
  origSetMany.call(prefStore, updates);
  savePrefs(prefStore.snapshot());
};

// Override set to also persist
const origSet = prefStore.set;
prefStore.set = function (key, value) {
  origSet.call(prefStore, key, value);
  savePrefs(prefStore.snapshot());
};

/**
 * useStore — Preact hook that subscribes to store changes.
 * Returns a snapshot of the store and re-renders on any change.
 */
export function useStore(store) {
  const [, bump] = useState(0);
  useEffect(() => {
    return subscribe(() => bump(n => n + 1));
  }, [store]);
  return store.snapshot();
}

/**
 * useStoreKey — Preact hook that subscribes to a single store key.
 * Re-renders only when that specific key changes.
 */
export function useStoreKey(store, key) {
  const [value, setValue] = useState(() => store.get(key));
  useEffect(() => {
    return store.subscribeKey(key, (v) => setValue(v));
  }, [store, key]);
  return value;
}

export { createStore };
export default appStore;