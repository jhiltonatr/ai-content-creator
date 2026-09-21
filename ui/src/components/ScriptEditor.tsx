import type { Character, DialogueBeat, ScriptBlock } from '../api/types';

interface ScriptEditorProps {
  value: ScriptBlock | null;
  characters: Character[];
  onChange: (script: ScriptBlock | null) => void;
  readOnly: boolean;
}

interface Form {
  sceneHeading: string;
  actionLines: string[];
  dialogue: DialogueBeat | null;
}

function toForm(initial: ScriptBlock | null): Form {
  if (!initial) return { sceneHeading: '', actionLines: [], dialogue: null };
  const beats = Array.isArray(initial.dialogue) ? initial.dialogue[0] ?? null : initial.dialogue ?? null;
  return {
    sceneHeading: initial.sceneHeading ?? '',
    actionLines: initial.actionLines ?? [],
    dialogue: beats,
  };
}

export default function ScriptEditor({ value, characters, onChange, readOnly }: ScriptEditorProps) {
  const form = toForm(value);

  const emit = (f: Form) => {
    onChange({
      sceneHeading: f.sceneHeading.trim() === '' ? null : f.sceneHeading,
      actionLines: f.actionLines.filter((l) => l.trim() !== ''),
      dialogue: f.dialogue,
    });
  };

  const patch = (p: Partial<Form>) => {
    emit({ ...form, ...p });
  };

  return (
    <div className="script">
      <div className="field">
        <label>Scene heading</label>
        <input
          disabled={readOnly}
          value={form.sceneHeading}
          placeholder="INT. MIDNIGHT DINER - NIGHT"
          onChange={(e) => patch({ sceneHeading: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Action lines (one per line)</label>
        <textarea
          disabled={readOnly}
          rows={3}
          value={form.actionLines.join('\n')}
          onChange={(e) => patch({ actionLines: e.target.value.split('\n') })}
          placeholder="Rain drums against the window…"
        />
      </div>
      <div className="field">
        <label>Dialogue</label>
        {form.dialogue ? (
          <div className="dialogue">
            <select
              disabled={readOnly}
              value={form.dialogue.characterId ?? ''}
              onChange={(e) =>
                patch({
                  dialogue: {
                    ...form.dialogue!,
                    characterId: e.target.value === '' ? null : Number(e.target.value),
                    characterName: characters.find((c) => c.id === Number(e.target.value))?.name ?? '',
                  },
                })
              }
            >
              <option value="">— choose character —</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              disabled={readOnly}
              value={form.dialogue.characterName ?? ''}
              placeholder="Character name"
              onChange={(e) => patch({ dialogue: { ...form.dialogue!, characterName: e.target.value } })}
            />
            <input
              disabled={readOnly}
              value={form.dialogue.parenthetical ?? ''}
              placeholder="(parenthetical)"
              onChange={(e) => patch({ dialogue: { ...form.dialogue!, parenthetical: e.target.value } })}
            />
            <textarea
              disabled={readOnly}
              rows={2}
              value={form.dialogue.line ?? ''}
              placeholder="Line…"
              onChange={(e) => patch({ dialogue: { ...form.dialogue!, line: e.target.value } })}
            />
            <button className="small linkish" disabled={readOnly} onClick={() => patch({ dialogue: null })}>
              Remove dialogue
            </button>
          </div>
        ) : (
          <button className="small" disabled={readOnly} onClick={() => patch({ dialogue: { line: '' } })}>
            + Add dialogue beat
          </button>
        )}
      </div>
    </div>
  );
}