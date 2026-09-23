import { useCallback, useRef, useState } from 'react';

const GOAL_KEY = 'storyforge:goal';
const WORDS_PREFIX = 'storyforge:words:';

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${WORDS_PREFIX}${y}-${m}-${day}`;
}

function readNumber(key: string, dflt: number): number {
  try {
    const v = Number(window.localStorage.getItem(key));
    return Number.isFinite(v) ? v : dflt;
  } catch {
    return dflt;
  }
}

export function useWritingStats() {
  const [goal, setGoalState] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem(GOAL_KEY);
      if (raw === null) return 500;
      const v = Number(raw);
      return Number.isFinite(v) && v >= 0 ? Math.round(v) : 500;
    } catch {
      return 500;
    }
  });
  const [dailyWords, setDailyWords] = useState<number>(() =>
    Math.max(0, readNumber(todayKey(), 0)),
  );
  const [sessionWords, setSessionWords] = useState(0);
  const dayRef = useRef(todayKey());

  const add = useCallback((delta: number) => {
    if (!Number.isFinite(delta) || delta <= 0) return;
    const key = todayKey();
    if (key !== dayRef.current) {
      dayRef.current = key;
      setDailyWords(0);
    }
    setSessionWords((prev) => prev + delta);
    setDailyWords((prev) => {
      const next = prev + delta;
      try {
        window.localStorage.setItem(dayRef.current, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setGoal = useCallback((next: number) => {
    const clamped = Number.isFinite(next) ? Math.max(0, Math.round(next)) : 0;
    try {
      window.localStorage.setItem(GOAL_KEY, String(clamped));
    } catch {
      /* ignore */
    }
    setGoalState(clamped);
  }, []);

  return { goal, setGoal, dailyWords, sessionWords, add };
}