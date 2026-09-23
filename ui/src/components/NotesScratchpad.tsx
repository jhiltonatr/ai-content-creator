import { useBooleanPref } from '../hooks/useLocalStoragePref';

interface NotesScratchpadProps {
  note: string;
  canWrite: boolean;
  onChange: (v: string) => void;
}

function previewOf(note: string): string {
  const first = note.split('\n').find((l) => l.trim() !== '') ?? '';
  return first.length > 60 ? `${first.slice(0, 60)}…` : first;
}

export default function NotesScratchpad({ note, canWrite, onChange }: NotesScratchpadProps) {
  const [open, setOpen] = useBooleanPref('storyforge:notes-open', true);

  return (
    <div className="notes-scratchpad">
      <button className="notes-toggle" onClick={() => setOpen((prev) => !prev)}>
        <span className={`notes-caret${note ? ' has-note' : ''}`}>{open ? '▾' : '▸'}</span>
        <strong>Notes</strong>
        {note ? (
          <span className="notes-preview muted small">{previewOf(note)}</span>
        ) : (
          <span className="notes-suggestion muted small">What do I want to write here?</span>
        )}
        <span className="notes-chars muted small">{note.length} chars</span>
      </button>
      {open && (
        <>
          {canWrite ? (
            <textarea
              className="notes-textarea"
              value={note}
              onChange={(e) => onChange(e.target.value)}
              rows={3}
              placeholder="Scratchpad — jot down what you want to write in this node. Autosaves like the body but never publishes."
            />
          ) : (
            <div className="notes-readonly muted">{note || 'No notes.'}</div>
          )}
        </>
      )}
    </div>
  );
}