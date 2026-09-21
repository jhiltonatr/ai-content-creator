import { Mention } from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { useEffect, useRef } from 'react';
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
}

export default function RichEditor({ initial, onChange, readOnly, mentions = [] }: RichEditorProps) {
  const mentionsRef = useRef<MentionItem[]>(mentions);
  useEffect(() => {
    mentionsRef.current = mentions;
  }, [mentions]);

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
    ],
    content: normalizeContent(initial),
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON() as TipTapDoc);
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [readOnly, editor]);

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
    </div>
  ) : null;

  return (
    <div className="rich">
      {menu}
      <EditorContent editor={editor} />
    </div>
  );
}