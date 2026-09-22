import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { MentionItem } from '../lib/mentionSync';

export type { MentionItem };

interface MentionListHandle {
  onUp: () => void;
  onDown: () => void;
  onEnter: () => void;
}

interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
  query?: string;
  text?: string;
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>(function MentionList({ items, command }, ref) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [items]);

  useEffect(() => {
    const el = document.querySelector('.mention-item.active');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const select = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(
    ref,
    () => ({
      onUp: () => setSelected((i) => (i - 1 + items.length) % items.length),
      onDown: () => setSelected((i) => (i + 1) % items.length),
      onEnter: () => select(selected),
    }),
    [items, selected],
  );

  if (items.length === 0) {
    return <div className="mention-pop">{<div className="mention-empty">No matches</div>}</div>;
  }

  return (
    <div className="mention-pop">
      {items.map((item, i) => (
        <button
          type="button"
          key={item.id}
          className={`mention-item ${i === selected ? 'active' : ''}`}
          onMouseEnter={() => setSelected(i)}
          onClick={() => select(i)}
        >
          <span className={`badge k-${item.type}`}>{item.type}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
});

type RendererInstance = ReactRenderer<MentionListHandle, MentionListProps>;

export function mentionRenderer() {
  let renderer: RendererInstance | null = null;
  let unmount: (() => void) | null = null;
  return {
    onStart: (props: SuggestionProps<MentionItem>) => {
      if (renderer) return;
      const r = new ReactRenderer(MentionList, {
        props: { ...props, items: props.items, command: props.command },
        editor: props.editor,
      });
      renderer = r;
      unmount = props.mount(r.element);
    },
    onUpdate: (props: SuggestionProps<MentionItem>) => {
      renderer?.updateProps({
        items: props.items,
        command: props.command,
        query: props.query,
        text: props.text,
      });
    },
    onExit: () => {
      unmount?.();
      unmount = null;
      renderer?.destroy();
      renderer = null;
    },
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        renderer?.ref?.onUp();
        return true;
      }
      if (event.key === 'ArrowDown') {
        renderer?.ref?.onDown();
        return true;
      }
      if (event.key === 'Enter') {
        renderer?.ref?.onEnter();
        return true;
      }
      return false;
    },
  };
}