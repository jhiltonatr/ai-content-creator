import type { ReleaseNode } from '../api/types';

export interface ReaderNode extends ReleaseNode {
  children: ReaderNode[];
}

export const READER_MAX_RENDERED_LEAVES = 100;

export function buildReleaseTree(nodes: ReleaseNode[] | null | undefined): ReaderNode[] {
  const all: ReaderNode[] = (nodes ?? []).map((n) => ({ ...n, parentId: n.parentId ?? null, children: [] }));
  const byId = new Map<number, ReaderNode>();
  for (const n of all) byId.set(n.id, n);
  const roots: ReaderNode[] = [];
  for (const n of all) {
    const parentId = n.parentId ?? null;
    const parent = parentId === null ? null : byId.get(parentId);
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  return roots;
}

export function findReaderNode(nodes: ReaderNode[], id: number): ReaderNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findReaderNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function countLeaves(node: ReaderNode): number {
  if (node.children.length === 0) return 1;
  let total = 0;
  for (const c of node.children) total += countLeaves(c);
  return total;
}

export interface ReaderSection {
  node: ReaderNode;
  sections: ReaderSection[];
}

export interface ReaderPlan {
  section: ReaderSection | null;
  shown: number;
  total: number;
}

/**
 * Plans how much of a (sub)tree to render. A leaf node (no children) renders by
 * itself; a node with children renders its own content then its descendants.
 * Rendering is gated by READER_MAX_RENDERED_LEAVES — leaves beyond the budget
 * are dropped (with their ancestor chains) so huge releases stay snappy. The
 * caller surfaces `shown < total` as the "not all content is displayed" notice.
 */
export function buildReaderPlan(root: ReaderNode): ReaderPlan {
  if (root.children.length === 0) {
    return { section: { node: root, sections: [] }, shown: 1, total: 1 };
  }
  const budget = { shown: 0 };
  const sections: ReaderSection[] = [];
  for (const c of root.children) {
    const sub = planFor(c, budget);
    if (sub) sections.push(sub);
  }
  return { section: { node: root, sections }, shown: budget.shown, total: countLeaves(root) };
}

function planFor(node: ReaderNode, budget: { shown: number }): ReaderSection | null {
  if (node.children.length === 0) {
    if (budget.shown >= READER_MAX_RENDERED_LEAVES) return null;
    budget.shown += 1;
    return { node, sections: [] };
  }
  const sections: ReaderSection[] = [];
  for (const c of node.children) {
    const sub = planFor(c, budget);
    if (sub) sections.push(sub);
  }
  if (sections.length === 0) return null;
  return { node, sections };
}