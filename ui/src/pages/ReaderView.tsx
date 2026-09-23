import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { JsonValue, Release, Story } from '../api/types';

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

function BodyText({ body }: { body: JsonValue | null }) {
  const blocks = collectBlocks(body);
  if (blocks.length === 0) return <p className="muted">(no body)</p>;
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

export default function ReaderView({ story, canWrite }: ReaderViewProps) {
  const [latest, setLatest] = useState<Release | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .releaseLatest(story.id)
      .then(setLatest)
      .catch((e) => setMessage(e.message));
  }, [story.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page reader">
      <div className="page-head">
        <div>
          <h1>{story.title}</h1>
          <span className="muted">Published view{canWrite ? ' (you can also edit in the Drafts view)' : ''}</span>
        </div>
        <span className="badge role">VIEWER · published only</span>
      </div>
      {message && (
        <div className="banner error" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
      {!latest ? (
        <div className="card">
          <p>
            <strong>Nothing has been published yet.</strong>
          </p>
          <p className="muted">The owner publishes a release when they are ready; you will see it here.</p>
        </div>
      ) : (
        <div className="card">
          <div className="release-head">
            <strong>
              Release v{latest.version}
              {latest.name ? ` · ${latest.name}` : ''}
            </strong>
            <span className="muted small">{new Date(latest.publishedAt).toLocaleString()}</span>
          </div>
          {latest.notes && <p className="muted">{latest.notes}</p>}
          <ul className="reader-nodes">
            {latest.nodes?.map((n) => (
              <li key={n.id} className="reader-node">
                <div className="reader-node-title">
                  <span className="badge">{n.kind}</span> {n.title}
                </div>
                {n.script ? <ScriptBlockView script={n.script} /> : <BodyText body={n.body} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}