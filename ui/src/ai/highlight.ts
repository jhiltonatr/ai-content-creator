import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { AiFinding } from './analyze';

export interface AiHighlightState {
  decos: DecorationSet;
  findings: AiFinding[];
}

export const aiHighlightKey = new PluginKey<AiHighlightState>('aiHighlight');

function plugin(): Plugin<AiHighlightState> {
  return new Plugin<AiHighlightState>({
    key: aiHighlightKey,
    state: {
      init: () => ({ decos: DecorationSet.empty, findings: [] }),
      apply(tr, value) {
        const meta = tr.getMeta(aiHighlightKey) as Partial<AiHighlightState> | undefined;
        if (meta?.decos) {
          return { decos: meta.decos, findings: meta.findings ?? value.findings };
        }
        const mapped = value.decos.map(tr.mapping, tr.doc);
        return { decos: mapped, findings: value.findings };
      },
    },
    props: {
      decorations(state) {
        const v = aiHighlightKey.getState(state);
        return v?.decos ?? DecorationSet.empty;
      },
    },
  });
}

export function setAiFindings(editor: Editor, findings: AiFinding[]): void {
  const decos = DecorationSet.create(
    editor.state.doc,
    findings.map((f) =>
      Decoration.inline(f.from, f.to, {
        class: `ai-hl ai-hl-${f.severity}`,
        title: f.message,
      }),
    ),
  );
  editor.view.dispatch(editor.state.tr.setMeta(aiHighlightKey, { decos, findings }));
}

export const AiHighlight = Extension.create({
  name: 'aiHighlight',
  addProseMirrorPlugins() {
    return [plugin()];
  },
});