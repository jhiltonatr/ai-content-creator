import { Mention } from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { analyzeProse, filterFindingsToVisible, mapFindingsToPositions, type AiFinding } from '../ai/analyze';
import { AiHighlight, setAiFindings } from '../ai/highlight';
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
    return body as TipTapDoc;
  }
  if (Array.isArray(body) && body.length === 0) return emptyDoc();
  return emptyDoc();
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
    window.addEventListener('resize', onViewportChange, { passive: true });
    document.addEventListener('scroll', onViewportChange, true);
    el.addEventListener('scroll', onViewportChange, { passive: true });
    return () => {
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
    </div>
  ) : null;

  return (
    <div className="rich">
      {menu}
      <EditorContent editor={editor} className="rich-body" />
    </div>
  );
}