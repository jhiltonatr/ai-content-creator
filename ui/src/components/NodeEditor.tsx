import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Character, Lore, NodeFull, NodeStatus, ScriptBlock, StoryType } from '../api/types';
import MetadataBar from './MetadataBar';
import type { MentionItem } from './MentionList';
import RichEditor, { type TipTapDoc } from './RichEditor';
import ScriptEditor from './ScriptEditor';

interface NodeEditorProps {
  storyId: number;
  nodeId: number;
  storyType: StoryType;
  canWrite: boolean;
  onChanged: () => void;
  onDelete: () => void;
}

interface Pending {
  kind: 'body' | 'script';
  changeId: string;
  doc?: TipTapDoc;
  script?: ScriptBlock | null;
}

const AUTO_SAVE_MS = 1200;

export default function NodeEditor({
  storyId,
  nodeId,
  storyType,
  canWrite,
  onChanged,
  onDelete,
}: NodeEditorProps) {
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

  const nodeRef = useRef<NodeFull | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

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
          pendingRef.current = null;
          setConflict(null);
          setSavedAt(null);
          setEditorKey(n.id + n.version);
        })
        .catch((e) => setError(e.message));
      api
        .characters(storyId)
        .then(setCharacters)
        .catch(() => undefined);
      api
        .lore(storyId)
        .then(setLore)
        .catch(() => undefined);
    },
    [storyId],
  );

  useEffect(() => {
    load(nodeId);
  }, [nodeId, load]);

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
      const changeId = pendingRef.current?.changeId ?? crypto.randomUUID();
      pendingRef.current = { kind: 'body', changeId, doc };
      scheduleDebounced();
    },
    [scheduleDebounced],
  );

  const onScriptChange = useCallback(
    (script: ScriptBlock | null) => {
      setScriptDraft(script);
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

  if (!node) {
    return <p className="muted">Loading node…</p>;
  }

  const usesScript = storyType === 'SCRIPT' && node.kind === 'SCENE';

  const mentions: MentionItem[] = [
    ...characters.map((c) => ({ id: `character:${c.id}`, label: c.name, type: 'character' as const })),
    ...lore.map((l) => ({ id: `lore:${l.id}`, label: l.title, type: 'lore' as const })),
  ];

  return (
    <div className="node-editor">
      <MetadataBar
        node={node}
        title={title}
        status={status}
        canWrite={canWrite}
        saving={saving}
        savedAt={savedAt}
        onTitleChange={setTitle}
        onStatusChange={setStatus}
        onSave={saveMetadata}
        onDelete={canWrite ? remove : undefined}
      />
      {error && (
        <div className="banner error" onClick={() => setError(null)}>
          {error}
        </div>
      )}
      {conflict && (
        <div className="banner conflict">
          This node was edited elsewhere (now v{conflict.version}; you had v{node.version}).
          <div className="row">
            <button className="small primary" onClick={loadTheirs}>
              Load theirs
            </button>
            <button className="small" onClick={keepMine}>
              Keep mine
            </button>
          </div>
        </div>
      )}
      {usesScript ? (
        <ScriptEditor
          key={`script-${editorKey}`}
          value={scriptDraft}
          characters={characters}
          onChange={canWrite ? onScriptChange : () => undefined}
          readOnly={!canWrite}
        />
      ) : (
        <RichEditor
          key={`body-${editorKey}`}
          initial={node.body}
          onChange={canWrite ? onBodyChange : () => undefined}
          readOnly={!canWrite}
          mentions={mentions}
        />
      )}
    </div>
  );
}