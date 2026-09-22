import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type {
  CharacterSuggestion,
  ExtractionResponse,
  LoreSuggestion,
} from '../api/types';

export type ExtractionKind = 'characters' | 'lore';

export interface ExtractionHandlers {
  resp: ExtractionResponse | null;
  busy: boolean;
  err: string | null;
  items: (CharacterSuggestion | LoreSuggestion)[];
  extract: () => Promise<void>;
  addItem: (item: CharacterSuggestion | LoreSuggestion) => Promise<void>;
  addAll: () => Promise<void>;
  dismissError: () => void;
}

export function suggestionKey(item: CharacterSuggestion | LoreSuggestion): string {
  return 'name' in item ? item.name : item.title;
}

export function useExtraction(
  storyId: number,
  nodeId: number | null,
  kind: ExtractionKind,
  onAdd: (item: CharacterSuggestion | LoreSuggestion) => Promise<void>,
): ExtractionHandlers {
  const [resp, setResp] = useState<ExtractionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const onAddRef = useRef(onAdd);
  useEffect(() => {
    onAddRef.current = onAdd;
  });

  useEffect(() => {
    abortRef.current?.abort();
    setResp(null);
    setBusy(false);
    setErr(null);
    setAdded(new Set());
  }, [storyId, nodeId, kind]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const items = resp
    ? (kind === 'characters' ? resp.characters : resp.lore).filter(
        (item) => !added.has(suggestionKey(item)),
      )
    : [];

  const extract = useCallback(async () => {
    if (!nodeId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setErr(null);
    setAdded(new Set());
    try {
      const node = await api.node(storyId, nodeId);
      if (controller.signal.aborted) return;
      const response = await api.extractEntities(storyId, nodeId, node.body, [kind], controller.signal);
      if (controller.signal.aborted) return;
      setResp(response);
    } catch (e) {
      if (!controller.signal.aborted) setErr((e as Error).message);
    } finally {
      if (abortRef.current === controller) setBusy(false);
    }
  }, [storyId, nodeId, kind]);

  const addItem = useCallback(async (item: CharacterSuggestion | LoreSuggestion) => {
    try {
      await onAddRef.current(item);
      setAdded((prev) => new Set(prev).add(suggestionKey(item)));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  const addAll = useCallback(async () => {
    for (const item of items) {
      await addItem(item);
    }
  }, [items, addItem]);

  const dismissError = useCallback(() => setErr(null), []);

  return { resp, busy, err, items, extract, addItem, addAll, dismissError };
}