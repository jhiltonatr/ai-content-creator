import { useEffect, useMemo, useRef, useState } from 'react';

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keywords?: string[];
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  commands: PaletteCommand[];
  onClose: () => void;
}

function matches(cmd: PaletteCommand, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [cmd.label, cmd.hint ?? '', ...(cmd.keywords ?? [])].some((s) =>
    s.toLowerCase().includes(q),
  );
}

export default function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const hits = commands.filter((c) => matches(c, query));
    const q = query.trim().toLowerCase();
    if (q) {
      hits.sort((a, b) => {
        const aStart = a.label.toLowerCase().startsWith(q) ? 1 : 0;
        const bStart = b.label.toLowerCase().startsWith(q) ? 1 : 0;
        if (aStart !== bStart) return bStart - aStart;
        return 0;
      });
    }
    return hits;
  }, [commands, query]);

  const groups = useMemo(() => {
    const out: { group: string; items: PaletteCommand[] }[] = [];
    for (const c of filtered) {
      const g = out.find((x) => x.group === c.group);
      if (g) g.items.push(c);
      else out.push({ group: c.group, items: [c] });
    }
    return out;
  }, [filtered]);

  useEffect(() => {
    setActive(0);
  }, [query, commands]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runAt = (idx: number) => {
    const cmd = filtered[idx];
    if (cmd) cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const offsets = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const c of filtered) map.set(c.id, idx++);
    return map;
  }, [filtered]);

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command or search for a scene…"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="palette-list">
          {groups.map((g) => (
            <div key={g.group} className="palette-group">
              <div className="palette-group-label">{g.group}</div>
              {g.items.map((c) => {
                const idx = offsets.get(c.id) ?? 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`palette-item${idx === active ? ' active' : ''}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => c.run()}
                  >
                    <span className="palette-label">{c.label}</span>
                    {c.hint && <span className="palette-hint">{c.hint}</span>}
                    {c.shortcut && <kbd className="palette-kbd">{c.shortcut}</kbd>}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && <div className="palette-empty">No matching commands.</div>}
        </div>
      </div>
    </div>
  );
}