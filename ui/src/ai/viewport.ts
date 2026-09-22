import type { Editor } from '@tiptap/react';
import type { Node as PmNode } from '@tiptap/pm/model';
import { buildParagraphRefs } from './analyze';

export interface ViewportSelection {
  trimDoc: Record<string, unknown>;
  visibleNonBlank: number[];
}

const OVERLAP_FUZZ_PX = 4;

function fallbackSelection(doc: PmNode): ViewportSelection {
  const refs = buildParagraphRefs(doc);
  const visibleNonBlank: number[] = [];
  refs.forEach((ref, i) => {
    if (!ref.blank) visibleNonBlank.push(i);
  });
  return { trimDoc: doc.toJSON(), visibleNonBlank };
}

export function selectVisibleBlocks(editor: Editor): ViewportSelection {
  const view = editor.view;
  const doc = view.state.doc;
  const root = view.dom;
  const win = root.ownerDocument?.defaultView ?? null;
  if (!win) return fallbackSelection(doc);

  const rect = root.getBoundingClientRect();
  const visTop = Math.max(0, Math.min(win.innerHeight, rect.top));
  const visBottom = Math.max(0, Math.min(win.innerHeight, rect.bottom));
  const visLeft = Math.max(0, Math.min(win.innerWidth, rect.left));
  const visRight = Math.max(0, Math.min(win.innerWidth, rect.right));
  if (visRight <= visLeft || visBottom <= visTop) return fallbackSelection(doc);

  const topNodes: PmNode[] = [];
  const ranges: { start: number; end: number }[] = [];
  let pos = 1;
  doc.forEach((child) => {
    topNodes.push(child);
    ranges.push({ start: pos, end: pos + child.nodeSize });
    pos += child.nodeSize;
  });

  const domChildren = Array.from(root.children) as HTMLElement[];
  if (domChildren.length !== topNodes.length) return fallbackSelection(doc);

  const visible = topNodes.map((_, i) => {
    const childRect = domChildren[i].getBoundingClientRect();
    const top = Math.max(visTop, childRect.top);
    const bottom = Math.min(visBottom, childRect.bottom);
    const left = Math.max(visLeft, childRect.left);
    const right = Math.min(visRight, childRect.right);
    return right > left && bottom - top > OVERLAP_FUZZ_PX;
  });

  const visibleNonBlank: number[] = [];
  const refs = buildParagraphRefs(doc);
  refs.forEach((ref, i) => {
    if (ref.blank) return;
    const topIdx = ranges.findIndex((range) => ref.posStart >= range.start && ref.posEnd <= range.end);
    if (topIdx >= 0 && visible[topIdx]) visibleNonBlank.push(i);
  });

  const content: Record<string, unknown>[] = [];
  topNodes.forEach((node, i) => {
    if (visible[i]) content.push(node.toJSON());
  });

  return { trimDoc: { type: doc.type.name, content }, visibleNonBlank };
}