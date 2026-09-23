import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReaderNode } from '../lib/reader';

const COLLAPSED_KEY = (storyId: number) => `storyforge:reader-tree-collapsed:${storyId}`;

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

function ancestorsOf(nodes: ReaderNode[], targetId: number): number[] {
  const path: number[] = [];
  const walk = (list: ReaderNode[], trail: number[]): boolean => {
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

function leafCounts(nodes: ReaderNode[]): Map<number, number> {
  const map = new Map<number, number>();
  const walk = (n: ReaderNode): number => {
    let total: number;
    if (n.children.length === 0) {
      total = 1;
    } else {
      total = 0;
      for (const c of n.children) total += walk(c);
    }
    map.set(n.id, total);
    return total;
  };
  for (const n of nodes) walk(n);
  return map;
}

interface ReaderTreeProps {
  storyId: number;
  nodes: ReaderNode[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

interface ReaderTreeItemProps {
  node: ReaderNode;
  depth: number;
  selectedId: number | null;
  collapsed: Set<number>;
  counts: Map<number, number>;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
}

function ReaderTreeItem({ node, depth, selectedId, collapsed, counts, onSelect, onToggle }: ReaderTreeItemProps) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const count = counts.get(node.id) ?? 0;

  return (
    <li style={{ paddingLeft: `${depth * 14}px` }}>
      <div
        className={`tree-item reader-item${selectedId === node.id ? ' selected' : ''}`}
        role="button"
        aria-expanded={hasChildren ? !isCollapsed : undefined}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren && (
          <button
            className="tree-toggle"
            draggable={false}
            title={isCollapsed ? `Expand "${node.title}"` : `Collapse "${node.title}"`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        )}
        <span className="kind-tag">{node.kind}</span>
        <span className="node-title">{node.title}</span>
        {hasChildren && <span className="word-count">{count}</span>}
      </div>
      {!isCollapsed && hasChildren && (
        <ul>
          {node.children.map((c) => (
            <ReaderTreeItem
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              collapsed={collapsed}
              counts={counts}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function ReaderTree({ storyId, nodes, selectedId, onSelect }: ReaderTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<number>>(() => loadCollapsed(storyId));
  const counts = useMemo(() => leafCounts(nodes), [nodes]);

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

  const handleToggle = useCallback((id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <ul className="tree reader-tree">
      {nodes.map((n) => (
        <ReaderTreeItem
          key={n.id}
          node={n}
          depth={0}
          selectedId={selectedId}
          collapsed={collapsed}
          counts={counts}
          onSelect={onSelect}
          onToggle={handleToggle}
        />
      ))}
      {nodes.length === 0 && <li className="muted">This release has no published sections.</li>}
    </ul>
  );
}