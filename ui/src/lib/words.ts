import type { DialogueBeat, ScriptBlock } from '../api/types';
import type { TipTapDoc, TipTapNode } from './tiptap';

export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function countDocWords(doc: TipTapDoc | null | undefined): number {
  if (!doc) return 0;
  const parts: string[] = [];
  for (const node of doc.content ?? []) {
    collectText(node, parts);
  }
  return countWords(parts.join(' '));
}

function collectText(node: TipTapNode, out: string[]): void {
  if (node.type === 'text' && typeof node.text === 'string') {
    out.push(node.text);
  } else if (node.type === 'mention') {
    const attrs = node.attrs as { label?: string; id?: string } | undefined;
    out.push(attrs?.label ?? attrs?.id ?? '');
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) collectText(child, out);
  }
}

export function countScriptWords(script: ScriptBlock | null | undefined): number {
  if (!script) return 0;
  let total = countWords(script.sceneHeading);
  for (const line of script.actionLines ?? []) {
    total += countWords(line);
  }
  const beats: DialogueBeat[] = Array.isArray(script.dialogue)
    ? script.dialogue
    : script.dialogue
      ? [script.dialogue]
      : [];
  for (const beat of beats) {
    total += countWords(beat.characterName);
    total += countWords(beat.parenthetical);
    total += countWords(beat.line);
  }
  return total;
}