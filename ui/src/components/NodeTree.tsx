import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { api } from '../api/client';
import type { NodeKind, NodeSummary, StoryType } from '../api/types';
import { childKinds, ROOT_KINDS } from '../lib/archetypes';
import MoveNodeModal, { type MoveNodeTarget } from './MoveNodeModal';

const COLLAPSED_KEY = (storyId: number) => `storyforge:tree-collapsed:${storyId}`;

function loadCollapsed(storyId: number): Set<number> {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY(storyId));
    if (!raw) return new Set<number>();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<number>();
    return new Set<number>(parsed.filter((x): x is number => typeof x === 'number'));
  } catch {
    return new Set<number>();
  }
}

function ancestorsOf(nodes: NodeSummary[], targetId: number): number[] {
  const path: number[] = [];
  const walk = (list: NodeSummary[], trail: number[]): boolean => {
    for (const n of list) {
      const next = [...trail, n.id];
      if (n.id === targetId) {
        path.push(...trail);
        return true;
      }
      if (walk(n.children, next)) return true;
    }
    return false;
  };
  walk(nodes, []);
  return path;
}

interface NodeTreeProps {
  nodes: NodeSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  storyType: StoryType;
  storyId: number;
  canWrite: boolean;
  onChanged: () => void;
  onError?: (message: string) => void;
}

type DropPos = 'before' | 'into' | 'after';

interface FlatRow {
  id: number;
  parentId: number | null;
  kind: NodeKind;
  title: string;
  sortOrder: number;
}

function flatten(nodes: NodeSummary[]): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (list: NodeSummary[], parentId: number | null) => {
    for (const n of list) {
      out.push({ id: n.id, parentId, kind: n.kind, title: n.title, sortOrder: n.sortOrder });
      walk(n.children, n.id);
    }
  };
  walk(nodes, null);
  return out;
}

function isDescendant(nodes: NodeSummary[], ancestorId: number, candidateId: number): boolean {
  if (ancestorId === candidateId) return true;
  return nodes.some((n) => isDescendant(n.children, ancestorId, candidateId));
}

function sortGroup(rows: FlatRow[]): FlatRow[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function betweenOrder(lo: number, hi: number): number {
  const mid = Math.floor((lo + hi) / 2);
  return mid > lo ? mid : lo + 1;
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

interface NodeItemProps {
  node: NodeSummary;
  parentId: number | null;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  storyType: StoryType;
  storyId: number;
  canWrite: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragging: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
  onMovedByStep: (node: NodeSummary, dir: -1 | 1) => void;
  onMoveTo: (node: NodeSummary) => void;
  onDragStart: (node: NodeSummary) => (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (node: NodeSummary, parentId: number | null) => (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (node: NodeSummary) => (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (node: NodeSummary, parentId: number | null) => (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  dropFor: { id: number; pos: DropPos } | null;
  collapsed: Set<number>;
  onToggleCollapse: (id: number) => void;
}

function NodeItem({
  node,
  parentId,
  depth,
  selectedId,
  onSelect,
  storyType,
  storyId,
  canWrite,
  canMoveUp,
  canMoveDown,
  dragging,
  onChanged,
  onError,
  onMovedByStep,
  onMoveTo,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  dropFor,
  collapsed,
  onToggleCollapse,
}: NodeItemProps) {
  const [deleted, setDeleted] = useState(false);
  const isCollapsed = collapsed.has(node.id);

  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${node.title}" and everything under it?`)) return;
    try {
      await api.deleteNode(storyId, node.id);
      setDeleted(true);
      onChanged();
    } catch (err) {
      onError((err as Error).message);
    }
  };

  if (deleted) return null;

  const dropClass = dropFor && dropFor.id === node.id ? ` drop-${dropFor.pos}` : '';

  return (
    <li style={{ paddingLeft: `${depth * 14}px` }}>
      <div
        className={`tree-item${selectedId === node.id ? ' selected' : ''}${node.status === 'DONE' ? ' done' : ''}${dropClass}${dragging ? ' dragging' : ''}`}
        onClick={() => onSelect(node.id)}
        draggable={canWrite}
        onDragStart={canWrite ? onDragStart(node) : undefined}
        onDragOver={canWrite ? onDragOver(node, parentId) : undefined}
        onDragLeave={canWrite ? onDragLeave(node) : undefined}
        onDrop={canWrite ? onDrop(node, parentId) : undefined}
        onDragEnd={canWrite ? onDragEnd : undefined}
      >
        {node.children.length > 0 && (
          <button
            className="tree-toggle"
            draggable={false}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? `Expand "${node.title}"` : `Collapse "${node.title}"`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(node.id);
            }}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        )}
        <span className="kind-tag">{node.kind === 'SCENE' || node.status === 'DONE' ? '' : node.kind}</span>
        <span className="node-title">{node.title}</span>
        <span className="word-count" title="Words in this node">
          {node.wordCount ?? 0}
        </span>
        <span className="status-dot" title={node.status} />
        {canWrite && (
          <span className="node-actions">
            <button
              className="acts"
              draggable={false}
              disabled={!canMoveUp}
              title={canMoveUp ? 'Move up (within this parent)' : 'Already first'}
              onClick={(e) => {
                e.stopPropagation();
                onMovedByStep(node, -1);
              }}
            >
              ↑
            </button>
            <button
              className="acts"
              draggable={false}
              disabled={!canMoveDown}
              title={canMoveDown ? 'Move down (within this parent)' : 'Already last'}
              onClick={(e) => {
                e.stopPropagation();
                onMovedByStep(node, 1);
              }}
            >
              ↓
            </button>
            <button
              className="acts"
              draggable={false}
              title="Move to a different parent…"
              onClick={(e) => {
                e.stopPropagation();
                onMoveTo(node);
              }}
            >
              ⇱
            </button>
            <button className="del" draggable={false} onClick={remove} title="Delete">
              ×
            </button>
          </span>
        )}
      </div>
      {canWrite && <AllowedChildren storyType={storyType} node={node} storyId={storyId} onChanged={onChanged} />}
      {!isCollapsed && node.children.length > 0 && (
        <ul>
          {node.children.map((c, i) => (
            <NodeItem
              key={c.id}
              node={c}
              parentId={node.id}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              storyType={storyType}
              storyId={storyId}
              canWrite={canWrite}
              canMoveUp={i > 0}
              canMoveDown={i < node.children.length - 1}
              dragging={dragging}
              onChanged={onChanged}
              onError={onError}
              onMovedByStep={onMovedByStep}
              onMoveTo={onMoveTo}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              dropFor={dropFor}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
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
  onError,
}: NodeTreeProps) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: number; pos: DropPos } | null>(null);
  const [moveNode, setMoveNode] = useState<NodeSummary | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(() => loadCollapsed(storyId));

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY(storyId), JSON.stringify([...collapsed]));
    } catch {
      /* ignore */
    }
  }, [storyId, collapsed]);

  useEffect(() => {
    if (selectedId === null) return;
    setCollapsed((prev) => {
      const ancestors = ancestorsOf(nodes, selectedId);
      if (ancestors.length === 0 || ancestors.every((a) => !prev.has(a))) return prev;
      const next = new Set(prev);
      for (const a of ancestors) next.delete(a);
      return next;
    });
  }, [nodes, selectedId]);

  const handleToggleCollapse = useCallback((id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const flat = useMemo(() => flatten(nodes), [nodes]);
  const byId = useMemo(() => new Map(flat.map((f) => [f.id, f])), [flat]);

  const performMove = useCallback(
    async (nodeId: number, target: MoveNodeTarget): Promise<boolean> => {
      try {
        const full = await api.node(storyId, nodeId);
        const body: Record<string, unknown> = {
          expectedVersion: full.version,
          changeId: crypto.randomUUID(),
          parentId: target.parentId,
        };
        if (target.sortOrder !== undefined) body.sortOrder = target.sortOrder;
        await api.moveNode(storyId, nodeId, body);
        onChanged();
        return true;
      } catch (e) {
        onError?.((e as Error).message);
        onChanged();
        return false;
      }
    },
    [storyId, onChanged, onError],
  );

  const canDrop = useCallback(
    (drag: number, target: NodeSummary, targetParentId: number | null, pos: DropPos): boolean => {
      if (drag === target.id || isDescendant(nodes, drag, target.id)) return false;
      const dragRow = byId.get(drag);
      if (!dragRow) return false;
      if (pos === 'into') return childKinds(storyType, target.kind).includes(dragRow.kind);
      const parentKind = targetParentId === null ? null : (byId.get(targetParentId)?.kind ?? null);
      return parentKind === null
        ? ROOT_KINDS[storyType].includes(dragRow.kind)
        : childKinds(storyType, parentKind).includes(dragRow.kind);
    },
    [nodes, byId, storyType],
  );

  const orderForDnd = useCallback(
    (target: FlatRow, pos: 'before' | 'after'): number => {
      const group = sortGroup(flat.filter((f) => f.parentId === target.parentId));
      const idx = group.findIndex((f) => f.id === target.id);
      if (idx < 0) return pos === 'before' ? target.sortOrder - 10 : target.sortOrder + 10;
      if (pos === 'before') {
        const prev = idx > 0 ? group[idx - 1] : undefined;
        return prev ? betweenOrder(prev.sortOrder, target.sortOrder) : target.sortOrder - 10;
      }
      const next = idx < group.length - 1 ? group[idx + 1] : undefined;
      return next ? betweenOrder(target.sortOrder, next.sortOrder) : target.sortOrder + 10;
    },
    [flat],
  );

  const handleDragStart = useCallback(
    (node: NodeSummary) => (e: DragEvent<HTMLDivElement>) => {
      setDragId(node.id);
      setDropTarget(null);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(node.id));
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback(
    (node: NodeSummary, parentId: number | null) => (e: DragEvent<HTMLDivElement>) => {
      if (dragId === null || dragId === node.id) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const frac = (e.clientY - rect.top) / rect.height;
      const pos: DropPos = frac < 0.3 ? 'before' : frac > 0.7 ? 'after' : 'into';
      if (canDrop(dragId, node, parentId, pos)) {
        e.dataTransfer.dropEffect = 'move';
        setDropTarget((cur) => (cur && cur.id === node.id && cur.pos === pos ? cur : { id: node.id, pos }));
      } else {
        e.dataTransfer.dropEffect = 'none';
        setDropTarget((cur) => (cur && cur.id === node.id ? null : cur));
      }
    },
    [dragId, canDrop],
  );

  const handleDragLeave = useCallback(
    (node: NodeSummary) => () => {
      setDropTarget((cur) => (cur && cur.id === node.id ? null : cur));
    },
    [],
  );

  const handleDrop = useCallback(
    (node: NodeSummary, parentId: number | null) => async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const drag = dragId ?? Number(e.dataTransfer.getData('text/plain'));
      setDragId(null);
      setDropTarget(null);
      if (!drag || drag === node.id) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const frac = (e.clientY - rect.top) / rect.height;
      const pos: DropPos = frac < 0.3 ? 'before' : frac > 0.7 ? 'after' : 'into';
      const dragRow = byId.get(drag);
      if (!drag || !dragRow || !canDrop(drag, node, parentId, pos)) return;

      if (pos === 'into') {
        await performMove(drag, { parentId: node.id });
        return;
      }
      const targetRow = byId.get(node.id);
      if (!targetRow) return;
      await performMove(drag, {
        parentId: targetRow.parentId,
        sortOrder: orderForDnd(targetRow, pos),
      });
    },
    [dragId, byId, canDrop, orderForDnd, performMove],
  );

  const handleMovedByStep = useCallback(
    (node: NodeSummary, dir: -1 | 1) => {
      const entry = byId.get(node.id);
      if (!entry) return;
      const group = sortGroup(flat.filter((f) => f.parentId === entry.parentId));
      const idx = group.findIndex((f) => f.id === node.id);
      if (idx < 0) return;
      if (dir === -1 && idx === 0) return;
      if (dir === 1 && idx === group.length - 1) return;

      let sortOrder: number;
      if (dir === -1) {
        const prev = group[idx - 1];
        const prevPrev = idx > 1 ? group[idx - 2] : undefined;
        sortOrder = prevPrev ? betweenOrder(prevPrev.sortOrder, prev.sortOrder) : prev.sortOrder - 10;
      } else {
        const next = group[idx + 1];
        const nextNext = idx < group.length - 2 ? group[idx + 2] : undefined;
        sortOrder = nextNext ? betweenOrder(next.sortOrder, nextNext.sortOrder) : next.sortOrder + 10;
      }
      void performMove(node.id, { parentId: entry.parentId, sortOrder });
    },
    [byId, flat, performMove],
  );

  return (
    <>
      <ul className="tree">
        {nodes.map((n, i) => (
          <NodeItem
            key={n.id}
            node={n}
            parentId={null}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
            storyType={storyType}
            storyId={storyId}
            canWrite={canWrite}
            canMoveUp={i > 0}
            canMoveDown={i < nodes.length - 1}
            dragging={dragId !== null}
            onChanged={onChanged}
            onError={onError ?? ((m) => window.alert(m))}
            onMovedByStep={handleMovedByStep}
            onMoveTo={setMoveNode}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            dropFor={dropTarget}
            collapsed={collapsed}
            onToggleCollapse={handleToggleCollapse}
          />
        ))}
        {nodes.length === 0 && <li className="muted">No nodes yet.</li>}
      </ul>
      {canWrite && moveNode && (
        <MoveNodeModal
          node={moveNode}
          nodes={nodes}
          storyType={storyType}
          onClose={() => setMoveNode(null)}
          onMove={(node, target) => performMove(node.id, target)}
        />
      )}
    </>
  );
}