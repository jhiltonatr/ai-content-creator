import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { JsonValue, Release, Story } from '../api/types';
import ReaderTree from '../components/ReaderTree';
import {
  buildReaderPlan,
  buildReleaseTree,
  findReaderNode,
  type ReaderPlan,
  type ReaderSection,
} from '../lib/reader';

interface ReaderViewProps {
  story: Story;
  canWrite?: boolean;
}

function collectInline(node: JsonValue | null | undefined, out: string[]): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const child of node) collectInline(child, out);
    return;
  }
  if (typeof node !== 'object') {
    if (typeof node === 'string') out.push(node);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.text === 'string') out.push(obj.text);
  if (obj.type === 'mention') {
    const attrs = obj.attrs as Record<string, unknown> | undefined;
    if (typeof attrs?.label === 'string') out.push(attrs.label);
    else if (typeof attrs?.id === 'string' || typeof attrs?.id === 'number') out.push(String(attrs.id));
  } else if (obj.type === 'hardBreak' || obj.type === 'softBreak') {
    out.push('\n');
  }
  if (Array.isArray(obj.content)) {
    for (const child of obj.content) collectInline(child as JsonValue, out);
  }
}

interface BodyBlock {
  type: string;
  text: string;
}

function collectBlocks(body: JsonValue | null | undefined): BodyBlock[] {
  const out: BodyBlock[] = [];
  const walk = (node: JsonValue | null | undefined) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const obj = node as Record<string, unknown>;
    const type = typeof obj.type === 'string' ? obj.type : '';
    if (type === 'paragraph' || type === 'heading' || type === 'blockquote' || type === 'codeBlock') {
      const parts: string[] = [];
      collectInline(obj.content as JsonValue, parts);
      const text = parts.join('').trim();
      if (text) out.push({ type, text });
    } else if (Array.isArray(obj.content)) {
      for (const child of obj.content) walk(child as JsonValue);
    }
  };
  walk(body);
  return out;
}

function ActionLines({ lines }: { lines: string[] | null | undefined }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div className="reader-action">
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}

function ScriptBlockView({ script }: { script: unknown }) {
  if (!script || typeof script !== 'object') return null;
  const s = script as Record<string, unknown>;
  const heading = typeof s.sceneHeading === 'string' ? s.sceneHeading : null;
  const actionLines = Array.isArray(s.actionLines) ? (s.actionLines as string[]) : [];
  const dialogue = s.dialogue && typeof s.dialogue === 'object' ? (s.dialogue as Record<string, unknown>) : null;
  return (
    <div className="reader-script">
      {heading && <div className="reader-heading">{heading}</div>}
      <ActionLines lines={actionLines} />
      {dialogue && (
        <div className="reader-dialogue">
          <span className="reader-char">
            {String(dialogue.characterName ?? '')}
            {dialogue.parenthetical ? ` ${dialogue.parenthetical}` : ''}
          </span>
          <div>{String(dialogue.line ?? '')}</div>
        </div>
      )}
    </div>
  );
}

function BodyText({ body, container }: { body: JsonValue | null; container?: boolean }) {
  const blocks = collectBlocks(body);
  if (blocks.length === 0) {
    if (container) return null;
    return <p className="muted">(no body)</p>;
  }
  return (
    <div className="reader-body">
      {blocks.map((b, i) =>
        b.type === 'heading' ? (
          <p key={i} className="reader-head">
            <strong>{b.text}</strong>
          </p>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  );
}

function SectionView({ section, isMain }: { section: ReaderSection; isMain: boolean }) {
  const n = section.node;
  const title = isMain ? (
    <h2 className="reader-section-title">
      <span className="badge">{n.kind}</span> {n.title}
    </h2>
  ) : (
    <h3 className="reader-section-title">
      <span className="badge">{n.kind}</span> {n.title}
    </h3>
  );
  return (
    <div className={`reader-section${isMain ? ' reader-section-main' : ''}`}>
      {title}
      {n.script ? <ScriptBlockView script={n.script} /> : <BodyText body={n.body} container={isMain || section.sections.length > 0} />}
      {section.sections.length > 0 && (
        <div className="reader-subtree">
          {section.sections.map((s) => (
            <SectionView key={s.node.id} section={s} isMain={false} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReaderView({ story, canWrite }: ReaderViewProps) {
  const [latest, setLatest] = useState<Release | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(() => {
    api
      .releaseLatest(story.id)
      .then(setLatest)
      .catch((e) => setMessage(e.message));
  }, [story.id]);

  useEffect(() => {
    load();
    setSelectedId(null);
  }, [load]);

  const tree = useMemo(() => buildReleaseTree(latest?.nodes), [latest]);

  useEffect(() => {
    if (tree.length === 0) return;
    if (selectedId !== null && findReaderNode(tree, selectedId)) return;
    setSelectedId(tree[0].id);
  }, [tree, selectedId]);

  const selected = useMemo(
    () => (selectedId === null ? null : findReaderNode(tree, selectedId)),
    [tree, selectedId],
  );

  const plan: ReaderPlan | null = useMemo(
    () => (selected ? buildReaderPlan(selected) : null),
    [selected],
  );

  const truncated = plan !== null && plan.shown < plan.total;

  return (
    <div className="reader-workspace">
      <div className="reader-head">
        <div className="reader-head-title">
          <h1>{story.title}</h1>
          <span className="muted small">
            Published view{canWrite ? ' (you can also edit in the Drafts view)' : ''}
          </span>
        </div>
        <span className="badge role">VIEWER · published only</span>
      </div>
      {message && (
        <div className="banner error" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
      {!latest ? (
        <div className="reader-empty">
          <div className="card">
            <p>
              <strong>Nothing has been published yet.</strong>
            </p>
            <p className="muted">The owner publishes a release when they are ready; you will see it here.</p>
          </div>
        </div>
      ) : (
        <div className="workspace-row reader-row">
          <aside className="col tree-col reader-tree-col">
            <div className="col-head">
              <strong>{story.title}</strong>
              <span className="badge">{story.storyType}</span>
            </div>
            <div className="card tight reader-release">
              <strong>
                v{latest.version}
                {latest.name ? ` · ${latest.name}` : ''}
              </strong>
              <div className="muted small">{new Date(latest.publishedAt).toLocaleString()}</div>
              {latest.notes && <p className="muted small reader-release-notes">{latest.notes}</p>}
            </div>
            <ReaderTree storyId={story.id} nodes={tree} selectedId={selectedId} onSelect={setSelectedId} />
          </aside>
          <section className="col editor-col reader-content-col">
            {selected && plan && plan.section ? (
              <article className="reader-content">
                {truncated && (
                  <div className="banner reader-limit">
                    <strong>
                      Showing {plan.shown} of {plan.total} sections — not all content is currently displayed.
                    </strong>{' '}
                    Open a specific section in the story map to read the rest.
                  </div>
                )}
                <SectionView section={plan.section} isMain />
                {truncated && (
                  <p className="reader-limits-end muted">
                    — End of displayed content · {plan.shown} of {plan.total} sections —
                  </p>
                )}
              </article>
            ) : (
              <div className="reader-content">
                <p className="muted">Select a section from the story map to start reading.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}