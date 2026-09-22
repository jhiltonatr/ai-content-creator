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

function keyOf(item: CharacterSuggestion | LoreSuggestion): string {
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
        (item) => !added.has(keyOf(item)),
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
      setAdded((prev) => new Set(prev).add(keyOf(item)));
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

export function ExtractionResults({ state, kind }: { state: ExtractionHandlers; kind: ExtractionKind }) {
  const { resp, busy, err, items } = state;
  if (!resp && !err) return null;

  const addLabel = kind === 'characters' ? 'Add character' : 'Add lore';

  return (
    <div className="card tight suggest-results">
      {err && (
        <div className="banner error" onClick={state.dismissError}>
          {err}
        </div>
      )}
      {resp && !resp.enabled && (
        <div className="muted small">
          AI extraction is disabled on the server (storyforge.extraction.enabled = false).
        </div>
      )}
      {resp && resp.enabled && items.length === 0 && (
        <div className="muted small">
          {busy ? 'Extracting…' : 'No new suggestions.'}
        </div>
      )}
      {resp && resp.enabled && items.length > 0 && (
        <ul className="plain">
          {items.map((item) => (
            <li key={keyOf(item)} className="card tight">
              <strong>{keyOf(item)}</strong>
              {'bio' in item && item.bio && <p className="muted small">{item.bio}</p>}
              {'category' in item && item.category && <span className="badge">{item.category}</span>}
              {'body' in item && item.body && <p className="muted small">{item.body}</p>}
              <button className="small primary" onClick={() => state.addItem(item)}>
                {addLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
      {resp && resp.enabled && items.length > 0 && (
        <button className="small linkish" onClick={state.addAll}>
          Add all
        </button>
      )}
    </div>
  );
}