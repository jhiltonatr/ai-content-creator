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
  return (
    <div className="meta-bar">
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
        <select value={status} disabled={!canWrite} onChange={(e) => onStatusChange(e.target.value as NodeStatus)}>
          <option value="DRAFT">draft</option>
          <option value="DONE">done</option>
        </select>
        {canWrite && (
          <button className="primary small" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        {onDelete && (
          <button className="small danger" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
      <div className="meta-sub">
        <span className="badge">{node.kind}</span>
        <span className="muted">
          v{node.version} · updated {new Date(node.updatedAt).toLocaleString()}
        </span>
        {savedAt && <span className="ok">saved {savedAt}</span>}
      </div>
    </div>
  );
}