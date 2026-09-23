import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Character, Lore, NodeFull, NodeStatus, ScriptBlock } from '../api/types';
import { CATALOG_CHANGED_EVENT } from '../lib/catalog';
import type { TipTapDoc } from '../lib/tiptap';
import { countDocWords, countScriptWords } from '../lib/words';

const AUTO_SAVE_MS = 1200;

export interface PendingSave {
  kind: 'body' | 'script';
  changeId: string;
  doc?: TipTapDoc;
  script?: ScriptBlock | null;
}

interface UseNodeEditorArgs {
  storyId: number;
  nodeId: number;
  onChanged: () => void;
  onDelete: () => void;
}

export function useNodeEditor({ storyId, nodeId, onChanged, onDelete }: UseNodeEditorArgs) {
  const [node, setNode] = useState<NodeFull | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<NodeStatus>('DRAFT');
  const [scriptDraft, setScriptDraft] = useState<ScriptBlock | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [lore, setLore] = useState<Lore[]>([]);
  const [conflict, setConflict] = useState<NodeFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState<number>(nodeId);
  const [bodyWords, setBodyWords] = useState(0);
  const [scriptWords, setScriptWords] = useState(0);

  const nodeRef = useRef<NodeFull | null>(null);
  const pendingRef = useRef<PendingSave | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  const refreshCatalog = useCallback(() => {
    api
      .characters(storyId)
      .then(setCharacters)
      .catch(() => undefined);
    api
      .lore(storyId)
      .then(setLore)
      .catch(() => undefined);
  }, [storyId]);

  const load = useCallback(
    (nodeIdToLoad: number) => {
      api
        .node(storyId, nodeIdToLoad)
        .then((n: NodeFull) => {
          nodeRef.current = n;
          setNode(n);
          setTitle(n.title);
          setStatus(n.status);
          setScriptDraft(n.script ?? null);
          setBodyWords(countDocWords(n.body as TipTapDoc | null));
          setScriptWords(countScriptWords(n.script));
          pendingRef.current = null;
          setConflict(null);
          setSavedAt(null);
          setEditorKey(n.id + n.version);
        })
        .catch((e) => setError(e.message));
      refreshCatalog();
    },
    [storyId, refreshCatalog],
  );

  useEffect(() => {
    load(nodeId);
  }, [nodeId, load]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ storyId?: number }>).detail;
      if (!detail || detail.storyId === undefined || detail.storyId === storyId) {
        refreshCatalog();
      }
    };
    window.addEventListener(CATALOG_CHANGED_EVENT, handler);
    return () => window.removeEventListener(CATALOG_CHANGED_EVENT, handler);
  }, [storyId, refreshCatalog]);

  const flush = useCallback(async () => {
    const pending = pendingRef.current;
    const current = nodeRef.current;
    if (!pending || !current || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      let updated: NodeFull;
      if (pending.kind === 'body') {
        updated = await api.updateBody(storyId, current.id, {
          expectedVersion: current.version,
          changeId: pending.changeId,
          payload: pending.doc,
        });
      } else {
        updated = await api.updateScript(storyId, current.id, {
          expectedVersion: current.version,
          changeId: pending.changeId,
          payload: pending.script,
        });
      }
      if (pendingRef.current && pendingRef.current.changeId === pending.changeId) {
        pendingRef.current = null;
      }
      nodeRef.current = updated;
      setNode(updated);
      setSavedAt(new Date().toLocaleTimeString());
      onChanged();
      // a newer edit landed while saving — keep draining
      if (pendingRef.current) {
        void flush();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflict(e.current ?? null);
      } else {
        setError((e as Error).message);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [storyId, onChanged]);

  const scheduleDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void flush();
    }, AUTO_SAVE_MS);
  }, [flush]);

  const onBodyChange = useCallback(
    (doc: TipTapDoc | null) => {
      if (!doc) return;
      setBodyWords(countDocWords(doc));
      const changeId = pendingRef.current?.changeId ?? crypto.randomUUID();
      pendingRef.current = { kind: 'body', changeId, doc };
      scheduleDebounced();
    },
    [scheduleDebounced],
  );

  const onScriptChange = useCallback(
    (script: ScriptBlock | null) => {
      setScriptDraft(script);
      setScriptWords(countScriptWords(script));
      const changeId = pendingRef.current?.changeId ?? crypto.randomUUID();
      pendingRef.current = { kind: 'script', changeId, script };
      scheduleDebounced();
    },
    [scheduleDebounced],
  );

  const saveMetadata = useCallback(async () => {
    const current = nodeRef.current;
    if (!current || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const trimmed = title.trim();
      const updated = await api.updateNode(storyId, current.id, {
        expectedVersion: current.version,
        changeId: crypto.randomUUID(),
        ...(trimmed === '' ? {} : { title: trimmed }),
        status,
      });
      nodeRef.current = updated;
      setNode(updated);
      setTitle(trimmed === '' ? current.title : trimmed);
      setStatus(updated.status);
      setSavedAt(new Date().toLocaleTimeString());
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflict(e.current ?? null);
      } else {
        setError((e as Error).message);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [storyId, title, status, onChanged]);

  const loadTheirs = useCallback(() => {
    if (!conflict) return;
    nodeRef.current = conflict;
    setNode(conflict);
    setTitle(conflict.title);
    setStatus(conflict.status);
    setScriptDraft(conflict.script ?? null);
    setBodyWords(countDocWords(conflict.body as TipTapDoc | null));
    setScriptWords(countScriptWords(conflict.script));
    pendingRef.current = null;
    setConflict(null);
    setSavedAt(null);
    setEditorKey(conflict.id + conflict.version);
  }, [conflict]);

  const keepMine = useCallback(() => {
    if (!conflict) return;
    const current = nodeRef.current;
    if (!current) return;
    if (conflict.version > current.version) {
      nodeRef.current = { ...current, version: conflict.version };
      setNode({ ...current, version: conflict.version });
    }
    setConflict(null);
    if (pendingRef.current) {
      void flush();
    }
  }, [conflict, flush]);

  const remove = useCallback(async () => {
    if (!node || !window.confirm(`Delete "${node.title}" and everything under it?`)) return;
    try {
      await api.deleteNode(storyId, node.id);
      onDelete();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [node, storyId, onDelete]);

  return {
    node,
    title,
    setTitle,
    status,
    setStatus,
    scriptDraft,
    characters,
    lore,
    conflict,
    error,
    setError,
    saving,
    savedAt,
    editorKey,
    wordCount: bodyWords + scriptWords,
    onBodyChange,
    onScriptChange,
    saveMetadata,
    loadTheirs,
    keepMine,
    remove,
  };
}