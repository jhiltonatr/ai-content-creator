import { Fragment, type Node as PmNode, Slice } from '@tiptap/pm/model';
import { Mention } from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import {
  analyzeProse,
  filterFindingsToVisible,
  mapFindingsToPositions,
  severityGlyph,
  worstSeverity,
  type AiFinding,
} from '../ai/analyze';
import { AiHighlight, setAiFindings } from '../ai/highlight';
import { attachAiTooltip } from '../ai/tooltip';
import { selectVisibleBlocks } from '../ai/viewport';
import { mentionRenderer, type MentionItem } from './MentionList';

export interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

interface TipTapNode {
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

function demotePastedSlice(slice: Slice): Slice {
  return new Slice(splitPmPastedFragment(slice.content), slice.openStart, slice.openEnd);
}

function guardText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function mentionSuggestionConfig(
  char: string,
  kind: MentionItem['type'],
  getCandidates: () => MentionItem[],
): Omit<SuggestionOptions<MentionItem>, 'editor'> {
  return {
    char,
    pluginKey: new PluginKey(`mention-${kind}`),
    minQueryLength: 0,
    items: ({ query }) => {
      const q = query.toLowerCase().trim();
      const candidates = getCandidates().filter((c) => c.type === kind);
      const list = q === '' ? candidates : candidates.filter((c) => c.label.toLowerCase().includes(q));
      return list.slice(0, 8);
    },
    command: ({ editor, range, props: item }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: 'mention', attrs: { id: item.id, label: item.label, mentionSuggestionChar: char } },
          { type: 'text', text: ' ' },
        ])
        .run();
    },
    render: mentionRenderer,
  };
}

interface RichEditorProps {
  initial: unknown;
  onChange: (doc: TipTapDoc | null) => void;
  readOnly: boolean;
  mentions?: MentionItem[];
  storyId?: number;
  nodeId?: number;
}

const ANALYSIS_DEBOUNCE_MS = 3000;

export default function RichEditor({
  initial,
  onChange,
  readOnly,
  mentions = [],
  storyId,
  nodeId,
}: RichEditorProps) {
  const mentionsRef = useRef<MentionItem[]>(mentions);
  useEffect(() => {
    mentionsRef.current = mentions;
  }, [mentions]);

  const [aiOn, setAiOn] = useState(true);
  const [findings, setFindings] = useState<AiFinding[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const aiOnRef = useRef(aiOn);
  useEffect(() => {
    aiOnRef.current = aiOn;
  }, [aiOn]);
  const analyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);

  const runAnalysis = useCallback(
    (e: Editor) => {
      const context = {
        characters: mentionsRef.current.filter((m) => m.type === 'character').map((m) => m.label),
        lore: mentionsRef.current.filter((m) => m.type === 'lore').map((m) => m.label),
      };
      const fallback = (hits: AiFinding[]) => {
        setFindings(hits);
        const target = editorRef.current ?? e;
        if (!target.isDestroyed) setAiFindings(target, hits);
      };
      if (analysisAbortRef.current) {
        analysisAbortRef.current.abort();
      }
      const selection = selectVisibleBlocks(e);
      if (storyId === undefined || nodeId === undefined) {
        fallback(
          filterFindingsToVisible(analyzeProse(e.state.doc, context), e.state.doc, selection.visibleNonBlank),
        );
        return;
      }
      const sentDoc = e.state.doc;
      const controller = new AbortController();
      analysisAbortRef.current = controller;
      setAnalyzing(true);
      api
        .analyzeNode(storyId, nodeId, selection.trimDoc, controller.signal)
        .then((response) => {
          if (controller.signal.aborted || !aiOnRef.current) return;
          const target = editorRef.current ?? e;
          if (target.isDestroyed) return;
          if (!sentDoc.eq(target.state.doc)) return;
          const hits = mapFindingsToPositions(target.state.doc, response, selection.visibleNonBlank);
          setFindings(hits);
          setAiFindings(target, hits);
          setAnalyzing(false);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return;
          const target = editorRef.current ?? e;
          if (!target.isDestroyed) {
            const currentSelection = selectVisibleBlocks(target);
            fallback(
              filterFindingsToVisible(
                analyzeProse(target.state.doc, context),
                target.state.doc,
                currentSelection.visibleNonBlank,
              ),
            );
          }
          setAnalyzing(false);
        });
    },
    [storyId, nodeId],
  );

  const scheduleAnalysis = useCallback(
    (e: Editor) => {
      if (!aiOnRef.current) return;
      if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
      analyzeTimerRef.current = setTimeout(() => runAnalysis(e), ANALYSIS_DEBOUNCE_MS);
    },
    [runAnalysis],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Begin…' }),
      Mention.configure({
        renderHTML: ({ node }) => {
          const char = node.attrs.mentionSuggestionChar ?? '@';
          const kind = char === '#' ? 'lore' : 'character';
          return [
            'span',
            {
              'data-type': 'mention',
              'data-id': node.attrs.id,
              class: `mention mention-${kind}`,
            },
            `${char}${guardText(node.attrs.label ?? node.attrs.id)}`,
          ];
        },
        suggestions: [
          mentionSuggestionConfig('@', 'character', () => mentionsRef.current),
          mentionSuggestionConfig('#', 'lore', () => mentionsRef.current),
        ],
      }),
      AiHighlight,
    ],
    content: normalizeContent(initial),
    editable: !readOnly,
    editorProps: {
      transformPasted: (slice) => demotePastedSlice(slice),
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON() as TipTapDoc);
      scheduleAnalysis(e);
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [readOnly, editor]);

  const editorRef = useRef<Editor | null>(null);
  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  useEffect(() => {
    const el = editor?.view.dom;
    const current = editor;
    if (!el || !current) return;
    const onViewportChange = () => scheduleAnalysis(editorRef.current ?? current);
    const detachTooltip = attachAiTooltip(el);
    window.addEventListener('resize', onViewportChange, { passive: true });
    document.addEventListener('scroll', onViewportChange, true);
    el.addEventListener('scroll', onViewportChange, { passive: true });
    return () => {
      detachTooltip();
      window.removeEventListener('resize', onViewportChange);
      document.removeEventListener('scroll', onViewportChange, true);
      el.removeEventListener('scroll', onViewportChange);
    };
  }, [editor, scheduleAnalysis]);

  useEffect(() => {
    if (editor && aiOnRef.current) {
      const t = setTimeout(() => runAnalysis(editor), 0);
      return () => clearTimeout(t);
    }
  }, [editor, runAnalysis]);

  useEffect(
    () => () => {
      if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
      if (analysisAbortRef.current) analysisAbortRef.current.abort();
    },
    [],
  );

  const toggleAi = useCallback(() => {
    setAiOn((prev) => {
      const next = !prev;
      if (editor) {
        if (next) {
          runAnalysis(editor);
        } else {
          if (analysisAbortRef.current) analysisAbortRef.current.abort();
          setAnalyzing(false);
          setAiFindings(editor, []);
          setFindings([]);
        }
      }
      return next;
    });
  }, [editor, runAnalysis]);

  const menu = editor ? (
    <div className="menu">
      {[
        ['Bold', () => editor.chain().focus().toggleBold().run()],
        ['Italic', () => editor.chain().focus().toggleItalic().run()],
        ['Heading', () => editor.chain().focus().toggleHeading({ level: 2 }).run()],
        ['Quote', () => editor.chain().focus().toggleBlockquote().run()],
        ['Bullet list', () => editor.chain().focus().toggleBulletList().run()],
      ].map(([label, fn]) => (
        <button key={label as string} className="small" onMouseDown={(e) => e.preventDefault()} onClick={fn as () => void}>
          {label as string}
        </button>
      ))}
      <button
        className={`small ai-toggle${aiOn ? ' on' : ''}`}
        title="Syntax analysis highlighting"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleAi}
      >
        AI{findings.length > 0 ? `: ${findings.length}` : ''}
      </button>
      {(() => {
        const sev = worstSeverity(findings);
        const label = aiOn
          ? sev === null
            ? 'no issues'
            : `${findings.length} finding${findings.length === 1 ? '' : 's'} (worst: ${sev})`
          : 'off';
        return (
          <span
            className={`analysis-state${analyzing ? ' busy' : aiOn ? ` done sev-${sev ?? 'clean'}` : ''}`}
            title={analyzing ? 'Analysis in progress…' : `Analysis finished — ${label}`}
            aria-live="polite"
          >
            {analyzing ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <span className="state-glyph" aria-hidden="true">
                {severityGlyph(sev)}
              </span>
            )}
          </span>
        );
      })()}
    </div>
  ) : null;

  return (
    <div className="rich">
      {menu}
      <EditorContent editor={editor} className="rich-body" />
    </div>
  );
}