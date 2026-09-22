import { useCallback, useState } from 'react';

export function useBooleanPref(key: string, dflt: boolean): [boolean, (v: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const v = window.localStorage.getItem(key);
      return v === null ? dflt : v === '1';
    } catch {
      return dflt;
    }
  });

  const update = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? v(prev) : v;
        try {
          window.localStorage.setItem(key, next ? '1' : '0');
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [key],
  );

  return [value, update];
}

export function useStringPref<T extends string | null>(
  key: string,
  dflt: T,
  sanitize?: (raw: string) => T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return dflt;
      return sanitize ? sanitize(raw) : (raw as T);
    } catch {
      return dflt;
    }
  });

  const update = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? v(prev) : v;
        try {
          if (next === null) window.localStorage.removeItem(key);
          else window.localStorage.setItem(key, next);
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [key],
  );

  return [value, update];
}