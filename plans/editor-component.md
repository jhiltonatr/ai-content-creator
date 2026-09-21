# Plan: Editor Component (Markdown editor module)

Specs: `specs/editor-component.md` and `specs/editor-components/text-color.md`

Provide a better writing experience with an enriched text editor module in the UI.

## Design decisions

- The editor renders/handles **Markdown** (`spec`: "Extend from MD formatting for implementation simplicity"). Chapter content stays a plain Markdown string on the API — no API changes.
- New shared component `MarkdownEditor` replaces the raw `<textarea>` used for chapter bodies:
  - **Two tabs — Raw and Preview** (`spec`): "Raw" shows the Markdown source in a textarea with a formatting toolbar; "Preview" renders the Markdown to read-only HTML (`marked`, GFM + `breaks`).
  - **Formatting toolbar** applies to the current selection in the raw textarea (wrap or block-prefix, with toggle for repeated markers):
    bold `**…**`, italic `*…*`, strikethrough `~~…~~`, inline code `` `…` ``, link `[text](url)`, headings `## `, blockquote `> `, bullet list `- `, numbered list `1. `, fenced code block, and horizontal rule.
  - **Text color extension** (`specs/editor-components/text-color.md`): a color picker wraps the selection in `<span style="color:…">…</span>`, which passes through the Markdown renderer as inline HTML (colors the text in Preview too).
- The editor is controlled (`value` + `onChange`) so chapter save/dirty tracking keeps working unchanged.
- Preview output is the user's own content, rendered via `dangerouslySetInnerHTML` (no external/user-uploaded HTML is ever displayed).

## Tasks

- [x] ui: install `marked` for Markdown preview rendering
- [x] ui: add `MarkdownEditor` (`ui/src/components/MarkdownEditor.tsx`) with raw/preview tabs, selection-aware formatting toolbar, and text-color apply
- [x] ui: swap the chapter `<textarea>` for `MarkdownEditor` in `ui/src/components/NovelBookEditor.tsx`
- [x] ui: add editor styles (tabs, toolbar, preview typography) in `ui/src/index.css`
- [x] verify: run `npm run lint` and `npm run build`

### tracking

- [x] update `specs-implemented.md` with the editor-component entry