import { useState } from 'react';
import { api } from '../api/client';
import type { NodeKind, NodeSummary, StoryType } from '../api/types';
import { childKinds } from '../lib/archetypes';

interface NodeTreeProps {
  nodes: NodeSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  storyType: StoryType;
  storyId: number;
  canWrite: boolean;
  onChanged: () => void;
}

function AllowedChildren({ storyType, node, storyId, onChanged }: {
  storyType: StoryType;
  node: NodeSummary;
  storyId: number;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<NodeKind | ''>('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const kinds = childKinds(storyType, node.kind);

  const add = async () => {
    if (!kind || !title.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.createNode(storyId, { nodeType: kind, title, parentId: node.id });
      setTitle('');
      setOpen(false);
      onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="add-child">
      {open && (
        <div className="add-form child">
          <select value={kind} onChange={(e) => setKind(e.target.value as NodeKind)}>
            <option value="">kind…</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <button className="small primary" disabled={busy || !kind || !title.trim()} onClick={add}>
            Add
          </button>
          {message && <div className="banner error">{message}</div>}
        </div>
      )}
      <button className="small linkish" onClick={() => setOpen((v) => !v)}>
        {open ? 'cancel' : '+ child'}
      </button>
    </div>
  );
}

function NodeItem({ node, selectedId, onSelect, storyType, storyId, canWrite, onChanged, depth }: {
  node: NodeSummary;
  selectedId: number | null;
  onSelect: (id: number) => void;
  storyType: StoryType;
  storyId: number;
  canWrite: boolean;
  onChanged: () => void;
  depth: number;
}) {
  const [deleted, setDeleted] = useState(false);

  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${node.title}" and everything under it?`)) return;
    try {
      await api.deleteNode(storyId, node.id);
      setDeleted(true);
      onChanged();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  if (deleted) return null;

  return (
    <li style={{ paddingLeft: `${depth * 14}px` }}>
      <div
        className={`tree-item ${selectedId === node.id ? 'selected' : ''} ${node.status === 'DONE' ? 'done' : ''}`}
        onClick={() => onSelect(node.id)}
      >
        <span className="kind-tag">{node.kind === 'SCENE' || node.status === 'DONE' ? '' : node.kind}</span>
        <span className="node-title">{node.title}</span>
        <span className="word-count" title="Words in this node">
          {node.wordCount ?? 0}
        </span>
        <span className="status-dot" title={node.status} />
        {canWrite && (
          <button className="del" onClick={remove} title="Delete">
            ×
          </button>
        )}
      </div>
      {canWrite && <AllowedChildren storyType={storyType} node={node} storyId={storyId} onChanged={onChanged} />}
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <NodeItem
              key={c.id}
              node={c}
              selectedId={selectedId}
              onSelect={onSelect}
              storyType={storyType}
              storyId={storyId}
              canWrite={canWrite}
              onChanged={onChanged}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function NodeTree({
  nodes,
  selectedId,
  onSelect,
  storyType,
  storyId,
  canWrite,
  onChanged,
}: NodeTreeProps) {
  return (
    <ul className="tree">
      {nodes.map((n) => (
        <NodeItem
          key={n.id}
          node={n}
          selectedId={selectedId}
          onSelect={onSelect}
          storyType={storyType}
          storyId={storyId}
          canWrite={canWrite}
          onChanged={onChanged}
          depth={0}
        />
      ))}
      {nodes.length === 0 && <li className="muted">No nodes yet.</li>}
    </ul>
  );
}