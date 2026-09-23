import { Mention } from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { useEffect, useRef } from 'react';
import { severityGlyph, worstSeverity } from '../lib/ai/analyze';
import { AiHighlight } from '../lib/ai/highlight';
import { attachAiTooltip } from '../lib/ai/tooltip';
import {
  emitSyncMentionsDone,
  SYNC_MENTIONS_EVENT,
  syncMentionsInContent,
  type MentionItem,
  type MentionSyncKind,
  type MentionSyncRequest,
  type SyncNode,
} from '../lib/mentionSync';
import { demotePastedSlice, guardText, normalizeContent, type TipTapDoc } from '../lib/tiptap';
import { useAiAnalysis } from '../hooks/useAiAnalysis';
import { mentionRenderer } from './MentionList';
import { AI_TOGGLE_EVENT, emitAiState } from '../lib/aiBridge';

export type { TipTapDoc } from '../lib/tiptap';

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

  const editorRef = useRef<Editor | null>(null);

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
      analysis.scheduleAnalysis(e);
    },
  });

  const analysis = useAiAnalysis({ editor, editorRef, mentionsRef, storyId, nodeId });

  useEffect(() => {
    const onAiToggle = () => analysis.toggleAi();
    window.addEventListener(AI_TOGGLE_EVENT, onAiToggle);
    return () => window.removeEventListener(AI_TOGGLE_EVENT, onAiToggle);
  }, [analysis.toggleAi]);

  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [readOnly, editor]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<MentionSyncRequest>).detail;
      if (storyId === undefined || nodeId === undefined) return;
      if (!detail || detail.storyId !== storyId || detail.nodeId !== nodeId) return;
      if (detail.kind !== 'characters' && detail.kind !== 'lore') return;
      const current = editorRef.current;
      if (!current || !current.isEditable) return;
      const targetType = detail.kind === 'characters' ? 'character' : 'lore';
      const targets = mentionsRef.current.filter((m) => m.type === targetType);
      if (targets.length === 0) {
        emitSyncMentionsDone({ storyId, nodeId, kind: detail.kind as MentionSyncKind, count: 0 });
        return;
      }
      const json = current.state.doc.toJSON() as { content?: SyncNode[] };
      const result = syncMentionsInContent(json.content ?? [], targets);
      if (!result.changed || result.count === 0) {
        emitSyncMentionsDone({ storyId, nodeId, kind: detail.kind as MentionSyncKind, count: 0 });
        return;
      }
      current.commands.setContent({ type: 'doc', content: result.nodes });
      emitSyncMentionsDone({ storyId, nodeId, kind: detail.kind as MentionSyncKind, count: result.count });
    };
    window.addEventListener(SYNC_MENTIONS_EVENT, handler);
    return () => window.removeEventListener(SYNC_MENTIONS_EVENT, handler);
  }, [storyId, nodeId]);

  useEffect(() => {
    const el = editor?.view.dom;
    const current = editor;
    if (!el || !current) return;
    const onViewportChange = () => analysis.scheduleAnalysis(editorRef.current ?? current);
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
  }, [editor, analysis.scheduleAnalysis]);

  const { aiOn, findings, analyzing } = analysis;

  useEffect(() => {
    emitAiState({ on: aiOn, findings: findings.length });
  }, [aiOn, findings]);

  const menu = editor ? (
    <div className="menu">
      {[
        ['Bold', () => editor.chain().focus().toggleBold().run()],
        ['Italic', () => editor.chain().focus().toggleItalic().run()],
        ['Heading', () => editor.chain().focus().toggleHeading({ level: 2 }).run()],
        ['Quote', () => editor.chain().focus().toggleBlockquote().run()],
        ['Bullet list', () => editor.chain().focus().toggleBulletList().run()],
      ].map(([label, fn]) => (
        <button
          key={label as string}
          className="small"
          onMouseDown={(e) => e.preventDefault()}
          onClick={fn as () => void}
        >
          {label as string}
        </button>
      ))}
      <button
        className={`small ai-toggle${aiOn ? ' on' : ''}`}
        title="Syntax analysis highlighting"
        onMouseDown={(e) => e.preventDefault()}
        onClick={analysis.toggleAi}
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