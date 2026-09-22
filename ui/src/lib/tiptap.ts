import { Fragment, type Node as PmNode, Slice } from '@tiptap/pm/model';

export interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

export interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  [key: string]: unknown;
}

export function emptyDoc(): TipTapDoc {
  return { type: 'doc', content: [] };
}

export function normalizeContent(body: unknown): TipTapDoc {
  if (body && typeof body === 'object' && (body as { type?: string }).type === 'doc') {
    const doc = body as TipTapDoc;
    return { ...doc, content: splitParagraphNodes(demoteArray(doc.content ?? [])) };
  }
  if (Array.isArray(body) && body.length === 0) return emptyDoc();
  return emptyDoc();
}

function collectPlainText(node: TipTapNode): string {
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) return node.content.map(collectPlainText).join('');
  return '';
}

function codeBlockToParagraphs(node: TipTapNode): TipTapNode[] {
  return collectPlainText(node)
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }));
}

function demoteArray(nodes: TipTapNode[]): TipTapNode[] {
  const out: TipTapNode[] = [];
  for (const node of nodes) {
    if (node.type === 'codeBlock') {
      out.push(...codeBlockToParagraphs(node));
    } else if (Array.isArray(node.content)) {
      out.push({ ...node, content: demoteArray(node.content) });
    } else {
      out.push(node);
    }
  }
  return out;
}

function toTextOrBreak(child: TipTapNode): TipTapNode[] {
  if (child.type === 'text' && typeof child.text === 'string' && child.text.includes('\n')) {
    const parts = child.text.split('\n');
    const out: TipTapNode[] = [];
    parts.forEach((part, i) => {
      if (i > 0) out.push({ type: 'hardBreak' });
      if (part) out.push({ type: 'text', text: part });
    });
    return out;
  }
  return [child];
}

function trimTrailingBreaks(run: TipTapNode[]): void {
  while (run.length && run[run.length - 1].type === 'hardBreak') run.pop();
}

function splitRuns(inline: TipTapNode[]): TipTapNode[][] {
  const runs: TipTapNode[][] = [];
  let current: TipTapNode[] = [];
  let breaks = 0;
  for (const child of inline) {
    for (const ch of toTextOrBreak(child)) {
      if (ch.type === 'hardBreak') {
        breaks++;
        if (breaks === 1) {
          current.push(ch);
        } else {
          trimTrailingBreaks(current);
          if (current.length) runs.push(current);
          current = [];
        }
        continue;
      }
      breaks = 0;
      current.push(ch);
    }
  }
  trimTrailingBreaks(current);
  if (current.length) runs.push(current);
  return runs;
}

function splitParagraphNodes(nodes: TipTapNode[]): TipTapNode[] {
  const out: TipTapNode[] = [];
  for (const node of nodes) {
    if (node.type === 'paragraph' && Array.isArray(node.content)) {
      const runs = splitRuns(node.content);
      for (const run of runs) out.push({ type: 'paragraph', content: run });
    } else if (Array.isArray(node.content)) {
      out.push({ ...node, content: splitParagraphNodes(node.content) });
    } else {
      out.push(node);
    }
  }
  return out;
}

function splitPmPastedFragment(fragment: Fragment): Fragment {
  const nodes: PmNode[] = [];
  fragment.forEach((node) => {
    if (node.type.name === 'codeBlock') {
      const schema = node.type.schema;
      node.textContent
        .split(/\n{2,}/)
        .map((block) => block.replace(/\n/g, ' ').trim())
        .filter(Boolean)
        .forEach((text) => nodes.push(schema.nodes.paragraph.create({}, schema.text(text))));
    } else if (node.type.name === 'paragraph') {
      const runs: PmNode[][] = [];
      let current: PmNode[] = [];
      let breaks = 0;
      const flush = () => {
        while (current.length && current[current.length - 1].type.name === 'hardBreak') current.pop();
        if (current.length) {
          runs.push(current);
          current = [];
        }
      };
      node.forEach((child) => {
        if (child.type.name === 'hardBreak') {
          breaks++;
          if (breaks === 1) {
            current.push(child);
          } else {
            flush();
          }
        } else {
          breaks = 0;
          current.push(child);
        }
      });
      flush();
      const schema = node.type.schema;
      for (const run of runs) nodes.push(schema.nodes.paragraph.create({}, run));
    } else if (node.content.size) {
      nodes.push(node.copy(splitPmPastedFragment(node.content)));
    } else {
      nodes.push(node);
    }
  });
  return Fragment.fromArray(nodes);
}

export function demotePastedSlice(slice: Slice): Slice {
  return new Slice(splitPmPastedFragment(slice.content), slice.openStart, slice.openEnd);
}

export function guardText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}