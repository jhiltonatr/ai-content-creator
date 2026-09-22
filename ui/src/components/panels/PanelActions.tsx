interface PanelActionsProps {
  canWrite: boolean;
  addLabel: string;
  onAdd: () => void;
  nodeId: number | null;
  busy: boolean;
  onExtract: () => void;
  onSync: () => void;
  syncing: boolean;
  extractHint: string;
  syncHint: string;
  helpText: string;
}

export default function PanelActions({
  canWrite,
  addLabel,
  onAdd,
  nodeId,
  busy,
  onExtract,
  onSync,
  syncing,
  extractHint,
  syncHint,
  helpText,
}: PanelActionsProps) {
  if (!canWrite) return null;
  return (
    <div className="panel-actions">
      <button className="small primary" onClick={onAdd}>
        {addLabel}
      </button>
      <button className="small" disabled={!nodeId || busy} onClick={onExtract} title={extractHint}>
        {busy ? 'Extracting…' : 'Suggest from text'}
      </button>
      <button className="small" disabled={!nodeId} onClick={onSync} title={syncHint}>
        {syncing ? 'Syncing…' : 'Sync mentions'}
      </button>
      <span className="panel-help" title={helpText}>
        ?
      </span>
    </div>
  );
}