import { useEffect, useState } from 'react';
import type { StoryType } from '../api/types';
import { useNodeEditor } from '../hooks/useNodeEditor';
import MetadataBar from './MetadataBar';
import type { MentionItem } from '../lib/mentionSync';
import RichEditor from './RichEditor';
import ScriptEditor from './ScriptEditor';
import CheckpointsPanel from './CheckpointsPanel';
import NotesScratchpad from './NotesScratchpad';

interface NodeEditorProps {
  storyId: number;
  nodeId: number;
  storyType: StoryType;
  canWrite: boolean;
  onChanged: () => void;
  onDelete: () => void;
  onWordCount?: (nodeId: number, count: number) => void;
}

export default function NodeEditor({
  storyId,
  nodeId,
  storyType,
  canWrite,
  onChanged,
  onDelete,
  onWordCount,
}: NodeEditorProps) {
  const {
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
    wordCount,
    checkpoints,
    noteDraft,
    onNoteChange,
    checkpointing,
    restoring,
    onBodyChange,
    onScriptChange,
    saveMetadata,
    saveCheckpoint,
    restoreToCheckpoint,
    loadTheirs,
    keepMine,
    remove,
  } = useNodeEditor({ storyId, nodeId, onChanged, onDelete });

  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setHistoryOpen(false);
  }, [nodeId]);

  useEffect(() => {
    if (!node) return;
    onWordCount?.(node.id, wordCount);
  }, [node, wordCount, onWordCount]);

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
        checkpointing={checkpointing}
        checkpointCount={checkpoints.length}
        savedAt={savedAt}
        onTitleChange={setTitle}
        onStatusChange={setStatus}
        onSave={saveMetadata}
        onCheckpoint={() => void saveCheckpoint()}
        onHistory={() => setHistoryOpen(true)}
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
      <NotesScratchpad note={noteDraft} canWrite={canWrite} onChange={canWrite ? onNoteChange : () => undefined} />
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
          storyId={storyId}
          nodeId={node.id}
        />
      )}
      {historyOpen && (
        <CheckpointsPanel
          storyId={storyId}
          node={node}
          checkpoints={checkpoints}
          canWrite={canWrite}
          checkpointing={checkpointing}
          restoring={restoring}
          onSaveCheckpoint={saveCheckpoint}
          onRestore={restoreToCheckpoint}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}