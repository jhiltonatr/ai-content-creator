import { useState } from 'react';
import type { NodeFull, NodeStatus } from '../api/types';

interface MetadataBarProps {
  node: NodeFull;
  title: string;
  status: NodeStatus;
  canWrite: boolean;
  saving: boolean;
  savedAt: string | null;
  onTitleChange: (v: string) => void;
  onStatusChange: (v: NodeStatus) => void;
  onSave: () => void;
  onDelete?: () => void;
}

function readMinimized(): boolean {
  try {
    return window.localStorage.getItem('storyforge:meta-minimized') === '1';
  } catch {
    return false;
  }
}

export default function MetadataBar({
  node,
  title,
  status,
  canWrite,
  saving,
  savedAt,
  onTitleChange,
  onStatusChange,
  onSave,
  onDelete,
}: MetadataBarProps) {
  const [minimized, setMinimized] = useState(readMinimized);

  const toggle = () => {
    setMinimized((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('storyforge:meta-minimized', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className={`meta-bar${minimized ? ' minimized' : ''}`}>
      <div className="meta-row">
        <input
          className="title-input"
          value={title}
          disabled={!canWrite}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canWrite) onSave();
          }}
        />
        {canWrite && (
          <button className="primary small" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        <button
          className="small icon-btn"
          title={minimized ? 'Restore full header' : 'Minimize to title + save'}
          onClick={toggle}
        >
          {minimized ? '▴' : '▾'}
        </button>
        {!minimized && (
          <>
            <select value={status} disabled={!canWrite} onChange={(e) => onStatusChange(e.target.value as NodeStatus)}>
              <option value="DRAFT">draft</option>
              <option value="DONE">done</option>
            </select>
            {onDelete && (
              <button className="small danger" onClick={onDelete}>
                Delete
              </button>
            )}
          </>
        )}
      </div>
      {!minimized && (
        <div className="meta-sub">
          <span className="badge">{node.kind}</span>
          <span className="muted">
            v{node.version} · updated {new Date(node.updatedAt).toLocaleString()}
          </span>
          {savedAt && <span className="ok">saved {savedAt}</span>}
        </div>
      )}
    </div>
  );
}