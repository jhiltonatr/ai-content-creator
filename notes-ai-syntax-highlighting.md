# Exploration notes — TipTap + LLaMa syntax analysis & highlighting

Scope: add an AI module to the Storyforge MVP that analyzes the text a writer is editing
(grammar / style / repetition / passive voice / orphaned mentions / script-format
conformance) and highlights findings live in the TipTap editor. Companion to AGENTS.md;
does not modify it. Companion code lives in `ui/src/ai/`, `RichEditor.tsx`, and
`backend/.../core/analysis/`.

## Current state

- v0 implemented: **Core → LLaMa directly** over the OpenAI-compatible endpoint. On every
  edit, `RichEditor` debounces a POST to
  `Core /api/stories/{storyId}/nodes/{nodeId}/analyze` **with the live editor doc in the
  body** (`{"doc": <TipTap doc JSON>}`) — so the model analyzes what the author is looking
  at, not the last autosaved snapshot. Core checks read/draft access, renders the posted
  prose to plain paragraphs (falling back to the saved node body when no `doc` is given),
  calls `{storyforge.analysis.base-url}/v1/chat/completions` (llama on `:8081` today), and
  returns typed findings. No FastAPI wrapper yet — the Python AI & Enrichment Service
  remains the future landing spot per AGENTS.md.
- Editor: TipTap 3 + ProseMirror. Prose `body` is a TipTap doc JSON (`RichEditor.tsx`);
  script scenes use a structured `ScriptBlock` (`ScriptEditor.tsx`). `@`/`#` mentions
  render as inline atom nodes (`mention`), so prose already has lightweight entity links.
  Mention candidates (`character`/`lore`, `@`/`#`) are fetched by `NodeEditor` and kept fresh
  via a `storyforge:catalog-changed` window event emitted by the panel CRUD
  (`Panels.tsx` → `src/catalog.ts`).
- Autosave debounces ~1.2 s (`NodeEditor.tsx`); Vite proxies `/api → :8080` (Core itself
  calls llama on 8081 server-to-server; no `/ai` proxy needed).

## Goal decomposition

1. **Analysis** — turn the doc (and story context: story type, language, characters, lore)
   into a list of *findings* with spans, category, severity, and a human message.
2. **Transport** — get findings from the model to the UI (future: SSE/streaming).
3. **Rendering** — show highlights in the editor without corrupting author content.

## How to highlight in TipTap (span-painting)

| Option | Mechanism | Verdict |
| --- | --- | --- |
| A. **ProseMirror decorations** | A `Plugin` holds a `DecorationSet` in its state; `props.decorations`
  returns it; `Decoration.inline(from, to, attrs)` paints text. Doc JSON is untouched;
  spans are ephemeral. Map the set through `tr.mapping` on edits. | ✔ implemented |
| B. Custom inline mark | A mark (`data-ai`) written *into* the doc, persisted with `body`. | ✘ violates
  "AI never mutates author content"; pollutes prose JSON and version diffs |
| C. DOM overlay | Absolutely-positioned divs over the editor. | ✘ breaks on wrap/reflow/Zen |
| D. Separate side panel | Findings listed next to the editor; click-to-jump via `editor.chain().focus()` +
  coordinates. | complementary to A, not a replacement |

Decision A preserves the invariants: highlights are a *rendered view of an analysis payload*,
never part of a release or an edit. Read-only (viewer) passes can render them too.

## The mapping problem (LLM spans → ProseMirror positions)

Models return offsets in **plain text characters**; ProseMirror positions count within-node
steps plus node-boundary units, so they diverge at block boundaries and inline leaves.

Two viable strategies:

- **Per-block windowing (v0, used by the PoC).** Analyze each paragraph independently;
  paragraph content starts at `pos + 1`, so char index *i* ↔ position `pos + 1 + i`.
  Offsets never cross boundaries and prompt context stays small. A paragraph is small enough
  that even an LLM never needs re-reading the whole scene for local diagnostics.
- **Global char→pos map.** Serialize the whole doc (`doc.textBetween(0, size, '\n', '\n')`)
  while recording a position per char; model spans map to positions via the table. Needed for
  whole-scene analysis (continuity, arc shape). Keep spans sorted; decorations must be
  regenerated or mapped when the doc changes.

### Offsets contract between Core and the UI (important)

Core renders each prose paragraph to a plain string in `ProseExtractor`, **skipping blank
paragraphs**, in document order:

| TipTap node | Rendered as |
| --- | --- |
| `text` | its text |
| `mention` | `mentionSuggestionChar` (default `@`) + `label` (fallback `id`) — multi-char |
| `hardBreak` | `\n` |
| other inline leaf | single space |

`findings[].paragraph` indexes that rendered list (0-based); `from`/`to` are plain-char
offsets into `paragraphs[paragraph]` (to-exclusive).

The UI mirrors the first two rules exactly in `mapFindingsToPositions()` (`ui/src/ai/analyze.ts`):
it builds, per paragraph, a `posAt[]` table mapping each rendered char index to the ProseMirror
position where that char lives. For a multi-char mention (a single atom) every rendered char
maps to the same atom position; the table's last entry is the content-end position. Finding
offsets are clamped into the table and translated to decoration positions — a paragraph with
an unlinked mention renders as `@Name` in the backend, exactly as a mention highlights in
ProseMirror.

## LLaMa module options

| Option | What it is | Notes |
| --- | --- | --- |
| **Ollama (local)** | `ollama serve`; OpenAI-compatible endpoint too | v0 default loop: run on `:8081` (`OLLAMA_HOST=127.0.0.1:8081 ollama serve`, model `llama3.1`), no GPU needed at 3–8B sizes |
| llama.cpp server | OpenAI-compatible HTTP server, full quantization control | Prefer if deploying on a single box; `llama-server -p 8081` |
| Hosted (OpenRouter/Anthropic/…) | commercial APIs | Exchangeable behind an OpenAI-compatible client; LLaMa is just the first provider |

Per AGENTS.md the wrapper is eventually a small **Python/FastAPI** service. v0 skips the
wrapper: Core (`LlamaAnalysisClient`) hosts the prompt (system prompt built from
`storyType` + `language` + characters/lore context), calls the provider via the OpenAI
chat endpoint with `response_format: json_object`, and validates the model's output into
typed findings (severity ∈ info/warn/danger, category, clamps offsets, drops unparsable
output defensively). It never writes; findings are returned to the UI as ephemeral
highlights, and in v1 Core would persist them as annotation/suggestion records.
Unavailable/errant backends surface as `503 SERVICE_UNAVAILABLE` (and the UI falls back to
the local heuristic analyzer).

## Authorization & story scope

Drafts must never leak to viewers or through AI endpoints. The clean shape (matches the
existing single enforcement point):

```
UI  →  Core /api/stories/{id}/nodes/{nodeId}/analyze   (Core checks role + read access to the node)
Core → LLaMa:8081 (server-to-server, OpenAI-compatible; passes story type/language/context)
UI  ←  findings (paragraph index, char spans, category, severity, message)
```

The UI keeps sending `X-User-Id`; Core is the only component that knows anything about users.
The model is scoped exactly to what the requestor may read (drafts for draft-access members
only).

## Edit-time behavior (concurrency with autosave)

- Re-analyze on a 3 s idle debounce (`ANALYSIS_DEBOUNCE_MS`), `AbortController()` the
  in-flight request when a newer edit lands; stale responses are dropped. If the backend or
  llama is unreachable the UI falls back to the local heuristic analyzer, so highlighting
  never disappears.
- Findings are computed against the doc at request time; if the user typed since, the
  decoration set is **mapped** through the edit transactions (decoration plugin `apply`),
  which keeps highlights approximately positioned until the next analysis lands.
- Autosave remounts the editor (`key` bumps on node version), destroying the instance that
  fired a request. Responses therefore resolve against the **current** editor
  (`editorRef.current`): docs are compared structurally (`Node.eq`), so a response is still
  painted on the remounted editor when the text matches. This avoids dropped findings when
  llama is slower than the ~1 s autosave cadence.

## Viewport-only analysis (payload / token reduction)

- The client only sends the blocks currently visible in the editor viewport: a **trimmed
  TipTap doc** (`ui/src/ai/viewport.ts` → `selectVisibleBlocks`) whose top-level nodes are
  intersected against the window×editor rect (`getBoundingClientRect`, ~4 px fuzz). Safe
  fallbacks (whole doc) when layout can't be trusted (zero visible area, DOM/Doc child-count
  mismatch, no window).
- Response `paragraph` indices are relative to the trimmed doc, so the client remembers which
  full-doc paragraph each sent block was (`visibleNonBlank`) and passes it as a `shift` to
  `mapFindingsToPositions`; the heuristic stub is filtered to the same set via
  `filterFindingsToVisible`.
- Re-analysis is debounced (3 s idle) and re-triggered on the same cadence by scroll/resize
  (`document` scroll capture + window resize + editor element scroll), so highlights follow
  the view while scrolling.

## Implemented (v0)

Backend (`backend/.../core/analysis/`):
- `ProseExtractor` — renders TipTap prose JSON to plain paragraphs (see offsets contract).
- `AnalysisClient` (interface) + `LlamaAnalysisClient` — OpenAI-compatible chat call against
  `storyforge.analysis.base-url` (default `http://localhost:8081`); `response_format`
  JSON-object, temperature 0, one retry without it on HTTP 400, and one retry (3 s) on
  connection/timeout errors so a cold llama model load (~ >60 s) can finish; 10 s connect /
  configurable read timeout (default 180 s); robust parsing/validation of findings;
  failures → `503 SERVICE_UNAVAILABLE`. `LlamaAnalysisClient` offers an
  `analyze(request, AtomicBoolean abort)` overload that drives the HTTP call via
  `sendAsync` + a 50 ms poll loop and cancels the in-flight exchange
  (`future.cancel(true)`) the moment abort flips, throwing `AnalysisAbortedException`.
- `AnalyzeService` — split into `prepare(...)` (request thread: access check `READ_DRAFTS`,
  story/node load, language/character/lore context, `max-paragraphs` × `max-paragraph-chars`
  truncation) and `run(prepared, abort)` (async worker: zero DB, just the outbound AI call),
  so 4xx/5xx from validation still ride the normal `@RestControllerAdvice` path.
- `AnalyzeController` — `POST /api/stories/{storyId}/nodes/{nodeId}/analyze` with an
  **optional** TipTap doc payload `{"doc": ...}` (the editor sends its live doc; the saved
  body is the fallback). Now returns a `DeferredResult<AnalyzeResponse>`; the worker runs on
  a virtual-thread executor (`AnalysisExecutorConfig#analysisExecutor`,
  `@Bean(destroyMethod="shutdown")`, `@Qualifier("analysisExecutor")`). When the client
  disconnects, `onError`/`onTimeout`/`onCompletion` set the abort flag **and** interrupt the
  worker (`Future.cancel(true)`) so a long llama call stops promptly instead of running to
  the full timeout; the DeferredResult timeout (2× `timeout-ms` + 6 s) is only a backstop.
  `AnalysisAbortedException` is swallowed (nothing to deliver).
- Returns `{nodeId, storyId, model, analyzedAt, paragraphs[], findings[]}`.
- Config in `application.yml`: `storyforge.analysis.{base-url, model, timeout-ms,
  max-paragraphs, max-paragraph-chars}`.

UI:
- `ui/src/ai/analyze.ts` — `Analyzer` interface + heuristic `analyzeProse()` **fallback**
  (repeated words, filter words, passive voice, over-long sentences, un-linked names);
  `mapFindingsToPositions()` translates backend findings to decoration positions.
- `ui/src/ai/highlight.ts` — ProseMirror `Plugin` holding a `DecorationSet`
  (`aiHighlightKey`), the `AiHighlight` TipTap extension, and `setAiFindings()`.
  Span attrs carry `data-msg` / `data-reason` / `data-sug` (reason+suggestion come
  straight from the backend `AnalysisFinding` record).
- `ui/src/ai/tooltip.ts` — `attachAiTooltip(root)` mounts a styled, multi-line floating
  tooltip (`message` + `Why:` reason + `Fix:` suggestion) on `.ai-hl` hover, replacing the
  old single-line `title` attribute.
- `RichEditor.tsx` — debounced analysis on edit and on viewport scroll/resize, an **AI**
  toggle with a finding count, and the enriched hover tooltip; uses the backend when
  `storyId`/`nodeId` are provided, else the heuristic fallback (analyzes the full doc, then
  filtered to the visible blocks).
- `ui/src/ai/viewport.ts` — visible-block selection (`selectVisibleBlocks`) that trims the
  payload to the on-screen blocks.
- `styles.css` — `ai-hl` per-severity underline classes.

Tests: `AnalysisTest` (owner 200 with findings/paragraphs, viewer 403, empty prose
short-circuit, posted-doc-payload overrides saved body) and `AnalysisUnavailableTest`
(503 + `SERVICE_UNAVAILABLE`), both with stubbed `AnalysisClient` via
`@TestConfiguration @Primary` beans — the OK/503 paths use MockMvc async dispatch
(`asyncStarted` → `asyncDispatch`) because the controller now returns a `DeferredResult`;
the 403 stays synchronous (thrown from `prepare`). `AnalysisCancellationTest` spins an
in-process JDK `HttpServer` that sleeps on `/v1/chat/completions` and verifies flipping the
abort flag frees the worker (`AnalysisAbortedException` in well under the response delay).

Not implemented: streaming, persistence of findings, script-format conformance (structured
`ScriptBlock` analysis), the FastAPI wrapper, and viewer-facing highlights of a release.

## Invariants

1. Decorations only �?" AI never writes into the node document or `script`/`meta` payloads.
2. Core is the only authorization point; llama is reached server-to-server and gets exactly
   the content the requestor may read.
3. Findings are derived from exactly what the requestor may read (drafts for draft-access
   members only).
4. Stale/cancelled AI results never paint over newer edits.

## Pasted drafts must never vanish into a code block (2026-09-22)

Pasting markdown-like text into the editor used to be captured by Tiptap's CodeBlock paste
rule, producing a `codeBlock` node (with `language:"markdown"`). Inside a code block the
mention atoms never form (`@`/`#` stay literal) AND `ProseExtractor` skipped it, so /analyze
returned an instant empty 200 (no AI task, no findings). Two-part fix:

1. `ui/src/components/RichEditor.tsx` — `normalizeContent()` demotes any stored `codeBlock`
   to paragraphs on load, and `editorProps.transformPasted` demotes pasted code blocks to
   paragraphs (`\n\n` = new paragraph, single `\n` = space; existing fenced text keeps its
   fence lines as literal text). No toolbar action creates code blocks, so they no longer
   appear at all.
2. `backend ProseExtractor` — treats `codeBlock` and `heading` as prose leaves, so any block
   that slips through is still analyzed.

Note: a codeBlock pasted before these fixes may have left a half-mention / dropped-character
body behind (e.g. "@Elian n is a bad person.", "@Marrow ow went to ..."); those stored docs
need a manual rewrite, not a migration.

## Open questions

- Re-introducing the FastAPI AI service (per AGENTS.md) vs keeping Core→llama direct; batching:
  per-paragraph requests vs one request per node (prompt cost vs responsiveness).
- Whether the reader/published faces should eventually show highlights from a release's
  annotations.
- Persisting findings: Core annotation records keyed by `(nodeId, analysisId, span)`
  (v1), and whether releases should optionally ship an "annotations" view for viewers.
- Which LLaMa model/size for acceptable latency on the target machines.