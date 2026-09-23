import { useEffect, useRef } from 'react';

type Handler = (e: KeyboardEvent) => void;

function matchBinding(e: KeyboardEvent, spec: string): boolean {
  const parts = spec.split('+');
  const keyPart = parts[parts.length - 1].toLowerCase();
  const mods = parts.slice(0, -1);
  const hasMod = mods.includes('mod');
  const hasCtrl = mods.includes('ctrl');
  const hasMeta = mods.includes('meta');
  const hasShift = mods.includes('shift');
  const hasAlt = mods.includes('alt');

  const modifierMatch =
    (hasMod || hasCtrl || hasMeta ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey) &&
    (hasShift ? e.shiftKey : !e.shiftKey) &&
    (hasAlt ? e.altKey : !e.altKey);

  return modifierMatch && e.key.toLowerCase() === keyPart;
}

export function useHotkeys(bindings: Record<string, Handler>): void {
  const ref = useRef(bindings);
  useEffect(() => {
    ref.current = bindings;
  }, [bindings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const [spec, handler] of Object.entries(ref.current)) {
        if (matchBinding(e, spec)) {
          e.preventDefault();
          e.stopPropagation();
          handler(e);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}