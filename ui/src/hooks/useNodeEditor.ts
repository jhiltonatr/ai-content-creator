import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Character, CheckpointSummary, Lore, NodeFull, NodeStatus, ScriptBlock } from '../api/types';
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
  const [restoring, setRestoring] = useState(false);
  const [checkpointing, setCheckpointing] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState<number>(nodeId);
  const [bodyWords, setBodyWords] = useState(0);
  const [scriptWords, setScriptWords] = useState(0);
  const [checkpoints, setCheckpoints] = useState<CheckpointSummary[]>([]);

  const nodeRef = useRef<NodeFull | null>(null);
  const pendingRef = useRef<PendingSave | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const conflictRef = useRef<NodeFull | null>(null);

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

  const reloadCheckpoints = useCallback(() => {
    const current = nodeRef.current;
    if (!current) return;
    api
      .checkpoints(storyId, current.id)
      .then(setCheckpoints)
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
          conflictRef.current = null;
          setConflict(null);
          setSavedAt(null);
          setEditorKey(n.id + n.version);
        })
        .catch((e) => setError(e.message));
      refreshCatalog();
      reloadCheckpoints();
    },
    [storyId, refreshCatalog, reloadCheckpoints],
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

  const surfaceError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 409 && e.current) {
      conflictRef.current = e.current;
      setConflict(e.current);
    } else {
      setError((e as Error).message);
    }
  }, []);

  // Core write operations assume the caller manages savingRef/saving state.
  const flushBodyOrScript = useCallback(
    async (pending: PendingSave): Promise<boolean> => {
      const current = nodeRef.current;
      if (!current) return false;
      try {
        const updated =
          pending.kind === 'body'
            ? await api.updateBody(storyId, current.id, {
                expectedVersion: current.version,
                changeId: pending.changeId,
                payload: pending.doc,
              })
            : await api.updateScript(storyId, current.id, {
                expectedVersion: current.version,
                changeId: pending.changeId,
                payload: pending.script,
              });
        if (pendingRef.current && pendingRef.current.changeId === pending.changeId) {
          pendingRef.current = null;
        }
        nodeRef.current = updated;
        setNode(updated);
        setScriptDraft(updated.script ?? null);
        setSavedAt(new Date().toLocaleTimeString());
        onChanged();
        return true;
      } catch (e) {
        surfaceError(e);
        return false;
      }
    },
    [storyId, onChanged, surfaceError],
  );

  const flush = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending || !nodeRef.current || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const ok = await flushBodyOrScript(pending);
      if (ok && pendingRef.current) {
        void flush();
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [flushBodyOrScript]);

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

  const saveMetadataCore = useCallback(async (): Promise<boolean> => {
    const current = nodeRef.current;
    if (!current) return false;
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
      return true;
    } catch (e) {
      surfaceError(e);
      return false;
    }
  }, [storyId, title, status, onChanged, surfaceError]);

  const saveMetadata = useCallback(async () => {
    if (!nodeRef.current || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await saveMetadataCore();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [saveMetadataCore]);

  /** Persists any pending edits first so the checkpoint snapshot is complete. */
  const saveCheckpoint = useCallback(
    async (note?: string | null): Promise<boolean> => {
      if (!nodeRef.current || savingRef.current) return false;
      savingRef.current = true;
      setCheckpointing(true);
      setError(null);
      try {
        if (pendingRef.current) {
          const flushed = await flushBodyOrScript(pendingRef.current);
          if (!flushed) return false;
        }
        const current = nodeRef.current;
        if (!current) return false;
        const trimmed = title.trim();
        if ((trimmed && trimmed !== current.title) || status !== current.status) {
          const saved = await saveMetadataCore();
          if (!saved) return false;
        }
        await api.createCheckpoint(storyId, current.id, { note: note || null });
        await reloadCheckpoints();
        setSavedAt(new Date().toLocaleTimeString());
        return true;
      } catch (e) {
        surfaceError(e);
        return false;
      } finally {
        savingRef.current = false;
        setCheckpointing(false);
      }
    },
    [storyId, title, status, flushBodyOrScript, saveMetadataCore, reloadCheckpoints, surfaceError],
  );

  const restoreToCheckpoint = useCallback(
    async (checkpointId: number): Promise<boolean> => {
      const current = nodeRef.current;
      if (!current || savingRef.current) return false;
      savingRef.current = true;
      setRestoring(true);
      setError(null);
      try {
        const updated = await api.restoreCheckpoint(storyId, current.id, checkpointId, {
          expectedVersion: current.version,
          changeId: crypto.randomUUID(),
        });
        nodeRef.current = updated;
        setNode(updated);
        setTitle(updated.title);
        setStatus(updated.status);
        setScriptDraft(updated.script ?? null);
        setBodyWords(countDocWords(updated.body as TipTapDoc | null));
        setScriptWords(countScriptWords(updated.script));
        pendingRef.current = null;
        conflictRef.current = null;
        setConflict(null);
        setSavedAt(null);
        setEditorKey(updated.id + updated.version);
        onChanged();
        await reloadCheckpoints();
        return true;
      } catch (e) {
        surfaceError(e);
        return false;
      } finally {
        savingRef.current = false;
        setRestoring(false);
      }
    },
    [storyId, onChanged, reloadCheckpoints, surfaceError],
  );

  const loadTheirs = useCallback(() => {
    const theirs = conflictRef.current;
    if (!theirs) return;
    nodeRef.current = theirs;
    setNode(theirs);
    setTitle(theirs.title);
    setStatus(theirs.status);
    setScriptDraft(theirs.script ?? null);
    setBodyWords(countDocWords(theirs.body as TipTapDoc | null));
    setScriptWords(countScriptWords(theirs.script));
    pendingRef.current = null;
    conflictRef.current = null;
    setConflict(null);
    setSavedAt(null);
    setEditorKey(theirs.id + theirs.version);
  }, []);

  const keepMine = useCallback(() => {
    const theirs = conflictRef.current;
    if (!theirs) return;
    const current = nodeRef.current;
    if (current && theirs.version > current.version) {
      nodeRef.current = { ...current, version: theirs.version };
      setNode({ ...current, version: theirs.version });
    }
    conflictRef.current = null;
    setConflict(null);
    if (pendingRef.current) {
      void flush();
    }
  }, [flush]);

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
    restoring,
    checkpointing,
    savedAt,
    editorKey,
    checkpoints,
    reloadCheckpoints,
    wordCount: bodyWords + scriptWords,
    onBodyChange,
    onScriptChange,
    saveMetadata,
    saveCheckpoint,
    restoreToCheckpoint,
    loadTheirs,
    keepMine,
    remove,
  };
}