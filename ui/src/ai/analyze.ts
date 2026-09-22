import type { Node as PmNode } from '@tiptap/pm/model';

export type AiSeverity = 'info' | 'warn' | 'danger';

export interface AiFinding {
  from: number;
  to: number;
  severity: AiSeverity;
  category: string;
  message: string;
  reason?: string;
  suggestion?: string;
}

export interface AnalyzerContext {
  characters: string[];
  lore: string[];
}

export interface Analyzer {
  analyze(doc: PmNode, context: AnalyzerContext): AiFinding[];
}

export interface AnalysisFindingDto {
  paragraph: number;
  from: number;
  to: number;
  severity: AiSeverity;
  category: string;
  message: string;
  reason?: string;
  suggestion?: string;
}

export interface AnalyzeNodeResponse {
  nodeId: number;
  storyId: number;
  model: string;
  analyzedAt: string;
  paragraphs: string[];
  findings: AnalysisFindingDto[];
}

const FILTER_WORDS = ['very', 'really', 'just', 'actually', 'basically', 'literally', 'simply'];

const PASSIVE_RE = /\b(?:was|were|been|being|has been|have been)\s+([a-z]+ed)\b/gi;

const PUNCT_RE = /^[\s.,!?;:'"()[\]{}…\-—–]+$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function push(
  spans: AiFinding[],
  from: number,
  to: number,
  severity: AiSeverity,
  category: string,
  message: string,
): void {
  if (to > from) spans.push({ from, to, severity, category, message });
}

function analyzeLocalStyle(text: string, blockStart: number, spans: AiFinding[]): void {
  const at = (i: number) => blockStart + i;

  const rep = /\b(\p{L}{3,})\b[\s,;:]+(\1\b)/giu;
  let m: RegExpExecArray | null;
  while (true) {
    m = rep.exec(text);
    if (!m) break;
    push(spans, at(m.index), at(m.index + m[0].length), 'warn', 'style', `Repeated word: “${m[1]}”.`);
    rep.lastIndex = m.index + 1;
  }

  for (const w of FILTER_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, 'gi');
    while ((m = re.exec(text)) !== null) {
      push(spans, at(m.index), at(m.index + w.length), 'info', 'clarity', `Filter word “${w}” — consider trimming.`);
    }
  }

  while ((m = PASSIVE_RE.exec(text)) !== null) {
    push(spans, at(m.index), at(m.index + m[0].length), 'warn', 'style', `Possible passive voice: “${m[0]}”.`);
  }

  let pos = 0;
  while (pos < text.length) {
    const rest = text.slice(pos);
    const endIdx = rest.search(/[.!?](?:\s|$)/);
    const end = endIdx === -1 ? text.length : pos + endIdx + 1;
    const sentence = text.slice(pos, end).trim();
    const words = sentence.split(/\s+/).filter(Boolean).length;
    if (words > 30) {
      const startOffset = text.slice(pos, end).search(/\S/);
      push(spans, at(pos + startOffset), at(end), 'info', 'clarity', `Long sentence (${words} words) — consider splitting.`);
    }
    pos = end;
  }
}

function analyzeMentions(
  text: string,
  blockStart: number,
  linked: Set<string>,
  context: AnalyzerContext,
  spans: AiFinding[],
): void {
  for (const candidates of [context.characters, context.lore]) {
    for (const raw of candidates) {
      const name = raw.replace(PUNCT_RE, '');
      if (name.length < 2) continue;
      const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i');
      const m = re.exec(text);
      if (!m) continue;
      if (linked.has(name.toLowerCase())) continue;
      push(spans, blockStart + m.index, blockStart + m.index + name.length, 'info', 'consistency', `“${name}” appears without a linked mention (@${name}).`);
    }
  }
}

export function analyzeProse(doc: PmNode, context: AnalyzerContext): AiFinding[] {
  const spans: AiFinding[] = [];
  const linked = new Set<string>();
  doc.descendants((node) => {
    if (node.type.name === 'mention') {
      const label = String(node.attrs.label ?? node.attrs.id ?? '');
      if (label) linked.add(label.trim().toLowerCase());
    }
    return true;
  });
  doc.descendants((node, pos) => {
    if (node.isLeaf || node.type.name !== 'paragraph') return true;
    const text = node.textBetween(0, node.content.size, '\n', ' ');
    const blockStart = pos + 1;
    if (text.trim()) {
      analyzeLocalStyle(text, blockStart, spans);
      analyzeMentions(text, blockStart, linked, context, spans);
    }
    return true;
  });
  return spans;
}

export interface ParagraphRef {
  rendered: string;
  posAt: number[];
  blank: boolean;
  posStart: number;
  posEnd: number;
}

export function buildParagraphRefs(doc: PmNode): ParagraphRef[] {
  const refs: ParagraphRef[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return true;
    let rendered = '';
    const posAt: number[] = [];
    let cursor = pos + 1;
    node.forEach((child) => {
      if (child.type.name === 'text') {
        const text = child.text ?? '';
        for (const ch of text) {
          rendered += ch;
          posAt.push(cursor++);
        }
      } else if (child.type.name === 'mention') {
        const trigger = String(child.attrs.mentionSuggestionChar ?? '@');
        const label = String(child.attrs.label ?? child.attrs.id ?? '');
        rendered += trigger + label;
        const atomPos = cursor++;
        for (let k = 0; k < 1 + label.length; k++) {
          posAt.push(atomPos);
        }
      } else if (child.type.name === 'hardBreak') {
        rendered += '\n';
        posAt.push(cursor++);
      } else {
        rendered += ' ';
        posAt.push(cursor++);
      }
    });
    posAt.push(cursor);
    refs.push({
      rendered,
      posAt,
      blank: rendered.trim().length === 0,
      posStart: pos + 1,
      posEnd: pos + 1 + node.nodeSize,
    });
    return true;
  });
  return refs;
}

export function mapFindingsToPositions(
  doc: PmNode,
  response: AnalyzeNodeResponse,
  shift?: number[],
): AiFinding[] {
  const proseRefs = buildParagraphRefs(doc).filter((ref) => !ref.blank);
  const out: AiFinding[] = [];
  for (const finding of response.findings) {
    const paragraph = shift ? shift[finding.paragraph] : finding.paragraph;
    const ref = proseRefs[paragraph];
    if (!ref || ref.rendered.length === 0) continue;
    const max = ref.posAt.length - 1;
    const from = Math.max(0, Math.min(finding.from, max));
    const to = Math.max(from, Math.min(finding.to, max));
    if (to <= from) continue;
    const fromPos = ref.posAt[from];
    const toPos = ref.posAt[to];
    if (toPos <= fromPos) continue;
    out.push({
      from: fromPos,
      to: toPos,
      severity: finding.severity,
      category: finding.category,
      message: finding.message,
      reason: finding.reason,
      suggestion: finding.suggestion,
    });
  }
  return out;
}

export function filterFindingsToVisible(
  spans: AiFinding[],
  doc: PmNode,
  visibleNonBlank: number[],
): AiFinding[] {
  const refs = buildParagraphRefs(doc).filter((ref) => !ref.blank);
  const visible = new Set(visibleNonBlank);
  return spans.filter((span) => {
    for (let k = 0; k < refs.length; k++) {
      const ref = refs[k];
      if (span.from >= ref.posStart + 1 && span.from < ref.posEnd) {
        return visible.has(k);
      }
    }
    return false;
  });
}

export const stubAnalyzer: Analyzer = {
  analyze(doc, context) {
    return analyzeProse(doc, context);
  },
};