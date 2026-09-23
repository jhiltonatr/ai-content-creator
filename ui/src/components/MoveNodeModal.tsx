import { useMemo, useState } from 'react';
import Modal from './Modal';
import type { NodeKind, NodeSummary, StoryType } from '../api/types';
import { childKinds, kindLabel, ROOT_KINDS } from '../lib/archetypes';

export interface MoveNodeTarget {
  parentId: number | null;
  sortOrder?: number;
}

interface MoveNodeModalProps {
  node: NodeSummary;
  nodes: NodeSummary[];
  storyType: StoryType;
  onClose: () => void;
  onMove: (node: NodeSummary, target: MoveNodeTarget) => Promise<boolean>;
}

interface FlatRow {
  id: number;
  parentId: number | null;
  kind: NodeKind;
  title: string;
  path: string;
  sortOrder: number;
}

function flatten(nodes: NodeSummary[]): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (list: NodeSummary[], path: string | null, parentId: number | null) => {
    for (const n of list) {
      out.push({
        id: n.id,
        parentId,
        kind: n.kind,
        title: n.title,
        path: path ? `${path} / ${n.title}` : n.title,
        sortOrder: n.sortOrder,
      });
      walk(n.children, path ? `${path} / ${n.title}` : n.title, n.id);
    }
  };
  walk(nodes, null, null);
  return out;
}

function isDescendant(nodes: NodeSummary[], ancestorId: number, candidateId: number): boolean {
  if (ancestorId === candidateId) return true;
  return nodes.some((n) => isDescendant(n.children, ancestorId, candidateId));
}

export default function MoveNodeModal({ node, nodes, storyType, onClose, onMove }: MoveNodeModalProps) {
  const rows = useMemo(() => flatten(nodes), [nodes]);
  const currentParentId = useMemo(() => rows.find((r) => r.id === node.id)?.parentId ?? null, [rows, node.id]);

  const destinations = useMemo(() => {
    const canParent = (kind: NodeKind | null): boolean =>
      kind === null
        ? ROOT_KINDS[storyType].includes(node.kind)
        : childKinds(storyType, kind).includes(node.kind);

    const opts: { id: number | null; kind: NodeKind | null; label: string; path: string }[] = [];
    if (canParent(null)) {
      opts.push({ id: null, kind: null, label: 'Story root (top level)', path: '' });
    }
    for (const r of rows) {
      if (r.id === node.id) continue;
      if (isDescendant(nodes, node.id, r.id)) continue;
      if (canParent(r.kind)) {
        opts.push({ id: r.id, kind: r.kind, label: r.title, path: r.path });
      }
    }
    return opts;
  }, [rows, nodes, node, storyType]);

  const [parentId, setParentId] = useState<number | null>(currentParentId);
  const [position, setPosition] = useState<'top' | 'end' | number>('end');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentChildren = useMemo(() => {
    return rows
      .filter((r) => r.parentId === parentId && r.id !== node.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }, [rows, parentId, node.id]);

  const selectedParentLabel = destinations.find((d) => d.id === parentId)?.label;
  const parentAllowed = selectedParentLabel !== undefined;
  const unchanged = parentId === currentParentId && position === 'end';

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return destinations;
    return destinations.filter(
      (d) => d.label.toLowerCase().includes(q) || d.path.toLowerCase().includes(q) || (d.kind ?? 'root').toLowerCase().includes(q),
    );
  }, [destinations, search]);

  const pickParent = (id: number | null) => {
    setParentId(id);
    setPosition('end');
  };

  const submit = async () => {
    if (busy || !parentAllowed || unchanged) return;
    setBusy(true);
    setError(null);
    let sortOrder: number | undefined;
    if (position === 'top' && parentChildren.length > 0) {
      sortOrder = parentChildren[0].sortOrder - 10;
    } else if (typeof position === 'number') {
      const c = parentChildren.find((x) => x.id === position);
      if (c) {
        const idx = parentChildren.indexOf(c);
        const next = parentChildren[idx + 1];
        if (next) {
          const mid = Math.floor((c.sortOrder + next.sortOrder) / 2);
          sortOrder = mid > c.sortOrder ? mid : c.sortOrder + 1;
        } else {
          sortOrder = c.sortOrder + 10;
        }
      }
    }
    const ok = await onMove(node, { parentId, sortOrder });
    setBusy(false);
    if (!ok) setError('Move failed — try reloading the story if this keeps happening.');
    else onClose();
  };

  return (
    <Modal title={`Move “${node.title}”`} onClose={onClose}>
      <div className="modal-body">
        <p className="muted small">
          Destination must accept a {kindLabel(node.kind)} node. Drag &amp; drop in the tree is another way to reparent or reorder.
        </p>
        <input
          className="move-search"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter parents…"
        />
        <div className="move-options">
          {shown.map((d) => (
            <button
              key={d.id ?? 'root'}
              type="button"
              className={`move-option${parentId === d.id ? ' selected' : ''}`}
              onClick={() => pickParent(d.id)}
            >
              <span className="move-kind">{d.kind ?? 'ROOT'}</span>
              <span className="move-label">{d.label}</span>
              {d.id !== null && d.path && <span className="move-path">{d.path}</span>}
            </button>
          ))}
          {shown.length === 0 && <p className="muted small">No valid parents match.</p>}
        </div>
        {parentAllowed && (
          <label className="field">
            <span className="muted small">Placement under “{selectedParentLabel}”</span>
            <select value={String(position)} onChange={(e) => setPosition(e.target.value === 'top' ? 'top' : e.target.value === 'end' ? 'end' : Number(e.target.value))}>
              <option value="end">At the end</option>
              <option value="top">At the top</option>
              {parentChildren.map((c) => (
                <option key={c.id} value={c.id}>
                  After “{c.title}”
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <div className="banner error">{error}</div>}
      </div>
      <div className="modal-foot">
        <button className="small" onClick={onClose}>
          Cancel
        </button>
        <button className="small primary" disabled={busy || !parentAllowed || unchanged} onClick={submit}>
          {busy ? 'Moving…' : 'Move'}
        </button>
      </div>
    </Modal>
  );
}