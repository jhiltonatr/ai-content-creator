import type { Checkpoint, JsonValue, NodeFull, ScriptBlock } from '../api/types';

export type DiffLineKind = 'context' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface DiffSection {
  label: string;
  lines: DiffLine[];
}

export interface CompareSnapshot {
  title: string;
  body: JsonValue | null;
  script: ScriptBlock | null;
  meta: JsonValue | null;
}

export function fromCheckpoint(cp: Checkpoint): CompareSnapshot {
  return { title: cp.title, body: cp.body, script: cp.script, meta: cp.meta };
}

export function fromNode(node: NodeFull): CompareSnapshot {
  return { title: node.title, body: node.body, script: node.script, meta: node.meta };
}

export function diffSnapshots(a: CompareSnapshot, b: CompareSnapshot): DiffSection[] {
  const sections: DiffSection[] = [];

  const title = diffLines([a.title], [b.title]);
  if (hasChanges(title)) sections.push({ label: 'Title', lines: title });

  const body = diffLines(docToLines(a.body), docToLines(b.body));
  if (hasChanges(body)) sections.push({ label: 'Body', lines: body });

  const script = diffLines(scriptToLines(a.script), scriptToLines(b.script));
  if (hasChanges(script)) sections.push({ label: 'Script', lines: script });

  const meta = diffLines(metaToLines(a.meta), metaToLines(b.meta));
  if (hasChanges(meta)) sections.push({ label: 'Meta', lines: meta });

  return sections;
}

export function diffLines(before: string[], after: string[]): DiffLine[] {
  const n = before.length;
  const m = after.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = before[i] === after[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      out.push({ kind: 'context', text: before[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'removed', text: before[i] });
      i++;
    } else {
      out.push({ kind: 'added', text: after[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ kind: 'removed', text: before[i] });
    i++;
  }
  while (j < m) {
    out.push({ kind: 'added', text: after[j] });
    j++;
  }
  return out;
}

export function hasChanges(lines: DiffLine[]): boolean {
  return lines.some((l) => l.kind !== 'context');
}

export function changedStats(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.kind === 'added') added++;
    else if (line.kind === 'removed') removed++;
  }
  return { added, removed };
}

function blockToLines(node: { type?: string; content?: unknown[]; text?: string; [key: string]: unknown }): string[] {
  const pieces: string[] = [];
  const lines: string[] = [];
  collectTextForLines(node, pieces, lines);
  return lines.length > 0 ? lines : [pieces.join('')];
}

function collectTextForLines(
  node: { type?: string; content?: unknown[]; text?: string; [key: string]: unknown },
  current: string[],
  lines: string[],
): void {
  if (node.type === 'text' && typeof node.text === 'string') {
    const parts = node.text.split('\n');
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push(current.splice(0).join(''));
      if (part) current.push(part);
    });
    return;
  }
  if (node.type === 'hardBreak') {
    lines.push(current.splice(0).join(''));
    return;
  }
  if (node.type === 'mention') {
    const attrs = node.attrs as { label?: string; id?: string } | undefined;
    const label = attrs?.label ?? attrs?.id ?? '';
    if (label) current.push(label);
    return;
  }
  const content = node.content;
  if (Array.isArray(content)) {
    for (const child of content) collectTextForLines(child as typeof node, current, lines);
  }
}

export function docToLines(body: JsonValue | null | undefined): string[] {
  if (!body || typeof body !== 'object') return [];
  const doc = body as { content?: unknown[] };
  if (!Array.isArray(doc.content)) return [];
  const out: string[] = [];
  for (const block of doc.content) {
    out.push(...blockToLines(block as { type?: string; content?: unknown[]; text?: string }));
  }
  return out;
}

export function scriptToLines(script: ScriptBlock | null | undefined): string[] {
  if (!script) return [];
  const lines: string[] = [];
  if (script.sceneHeading) lines.push(script.sceneHeading);
  for (const action of script.actionLines ?? []) {
    if (action) lines.push(action);
  }
  const beats = Array.isArray(script.dialogue) ? script.dialogue : script.dialogue ? [script.dialogue] : [];
  for (const beat of beats) {
    const who = beat.characterName ?? `#${beat.characterId ?? '?'}`;
    const parenthetical = beat.parenthetical ? ` (${beat.parenthetical})` : '';
    lines.push(`${who}${parenthetical}: ${beat.line ?? ''}`.trimEnd());
  }
  return lines;
}

export function metaToLines(meta: JsonValue | null | undefined): string[] {
  if (meta === null || meta === undefined) return [];
  return JSON.stringify(meta, null, 2).split('\n');
}