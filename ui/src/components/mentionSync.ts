import type { MentionItem } from './MentionList';

export const SYNC_MENTIONS_EVENT = 'storyforge:sync-mentions';
export const SYNC_MENTIONS_DONE_EVENT = 'storyforge:sync-mentions-done';

export type MentionSyncKind = 'characters' | 'lore';

export interface MentionSyncRequest {
  storyId: number;
  nodeId: number;
  kind: MentionSyncKind;
}

export interface MentionSyncResult {
  storyId: number;
  nodeId: number;
  kind: MentionSyncKind;
  count: number;
}

export function emitSyncMentions(request: MentionSyncRequest): void {
  window.dispatchEvent(new CustomEvent(SYNC_MENTIONS_EVENT, { detail: request }));
}

export function emitSyncMentionsDone(result: MentionSyncResult): void {
  window.dispatchEvent(new CustomEvent(SYNC_MENTIONS_DONE_EVENT, { detail: result }));
}

export interface SyncNode {
  type: string;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
  content?: SyncNode[];
}

interface MentionHit {
  start: number;
  end: number;
  item: MentionItem;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function boundaryOf(label: string): string {
  return `(?<![\\p{L}\\p{N}_])${label}(?![\\p{L}\\p{N}_])`;
}

function findHits(text: string, items: MentionItem[]): MentionHit[] {
  const ordered = [...items].sort((a, b) => b.label.length - a.label.length);
  const parts = ordered.map((it) => `(${boundaryOf(escapeRegExp(it.label))})`);
  const re = new RegExp(parts.join('|'), 'giu');
  const hits: MentionHit[] = [];
  for (const m of text.matchAll(re)) {
    let index = 1;
    while (index <= ordered.length && m[index] === undefined) index++;
    if (index > ordered.length) continue;
    hits.push({ start: m.index, end: m.index + m[0].length, item: ordered[index - 1] });
  }
  return hits;
}

function syncText(node: SyncNode, hits: MentionHit[]): SyncNode[] {
  const text = typeof node.text === 'string' ? node.text : '';
  const marks = node.marks === undefined ? {} : { marks: node.marks };
  const out: SyncNode[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) {
      out.push({ type: 'text', text: text.slice(cursor, hit.start), ...marks });
    }
    out.push({
      type: 'mention',
      attrs: {
        id: hit.item.id,
        label: hit.item.label,
        mentionSuggestionChar: hit.item.type === 'lore' ? '#' : '@',
      },
    });
    cursor = hit.end;
  }
  if (cursor < text.length) {
    out.push({ type: 'text', text: text.slice(cursor), ...marks });
  }
  return out;
}

export function syncMentionsInContent(
  content: SyncNode[],
  items: MentionItem[],
): { nodes: SyncNode[]; changed: boolean; count: number } {
  if (items.length === 0) return { nodes: content, changed: false, count: 0 };
  let changed = false;
  let count = 0;
  const out: SyncNode[] = [];
  for (const node of content) {
    if (node.type === 'text' && typeof node.text === 'string') {
      const hits = findHits(node.text, items);
      if (hits.length === 0) {
        out.push(node);
      } else {
        changed = true;
        count += hits.length;
        out.push(...syncText(node, hits));
      }
    } else if (Array.isArray(node.content) && node.content.length > 0) {
      const inner = syncMentionsInContent(node.content, items);
      if (inner.changed) {
        changed = true;
        count += inner.count;
        out.push({ ...node, content: inner.nodes });
      } else {
        out.push(node);
      }
    } else {
      out.push(node);
    }
  }
  return { nodes: out, changed, count };
}