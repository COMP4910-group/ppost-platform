/**
 * Tiny shared-state helper.
 *
 * Creates a value that every component can read (and re-render on change),
 * saved in the browser's localStorage so it survives a refresh and page
 * switches. Used for the estimate and funding data until Supabase tables
 * exist — then only the load/save parts need to change.
 */
import { useSyncExternalStore } from 'react';

export interface PersistentStore<T> {
  get: () => T;
  set: (next: T) => void;
  use: () => T;
}

export function createPersistentStore<T>(
  storageKey: string,
  defaultValue: T,
  isValid: (value: unknown) => boolean = () => true,
): PersistentStore<T> {
  let value: T = defaultValue;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) value = parsed as T;
    }
  } catch {
    // storage unavailable or corrupted — keep the default
  }

  const listeners = new Set<() => void>();

  const get = () => value;
  const set = (next: T) => {
    value = next;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // storage unavailable — still works for this session
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  const use = () => useSyncExternalStore(subscribe, get, get);

  return { get, set, use };
}
