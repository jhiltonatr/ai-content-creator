import { suggestionKey, type ExtractionHandlers, type ExtractionKind } from '../hooks/useExtraction';

export function ExtractionResults({ state, kind }: { state: ExtractionHandlers; kind: ExtractionKind }) {
  const { resp, busy, err, items } = state;
  if (!resp && !err) return null;

  const addLabel = kind === 'characters' ? 'Add character' : 'Add lore';

  return (
    <div className="card tight suggest-results">
      {err && (
        <div className="banner error" onClick={state.dismissError}>
          {err}
        </div>
      )}
      {resp && !resp.enabled && (
        <div className="muted small">
          AI extraction is disabled on the server (storyforge.extraction.enabled = false).
        </div>
      )}
      {resp && resp.enabled && items.length === 0 && (
        <div className="muted small">
          {busy ? 'Extracting…' : 'No new suggestions.'}
        </div>
      )}
      {resp && resp.enabled && items.length > 0 && (
        <ul className="plain">
          {items.map((item) => (
            <li key={suggestionKey(item)} className="card tight">
              <strong>{suggestionKey(item)}</strong>
              {'bio' in item && item.bio && <p className="muted small">{item.bio}</p>}
              {'category' in item && item.category && <span className="badge">{item.category}</span>}
              {'body' in item && item.body && <p className="muted small">{item.body}</p>}
              <button className="small primary" onClick={() => state.addItem(item)}>
                {addLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
      {resp && resp.enabled && items.length > 0 && (
        <button className="small linkish" onClick={state.addAll}>
          Add all
        </button>
      )}
    </div>
  );
}