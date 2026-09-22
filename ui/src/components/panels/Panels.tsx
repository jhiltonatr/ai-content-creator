import type { Role } from '../../api/types';
import { PANEL_TABS, type PanelTab } from '../../lib/panels';
import { CharactersPanel } from './CharactersPanel';
import { LorePanel } from './LorePanel';
import { MembersPanel } from './MembersPanel';
import { ReleasesPanel } from './ReleasesPanel';

export type { PanelTab };
export { PANEL_TABS };

interface PanelsProps {
  storyId: number;
  nodeId: number | null;
  myRole: Role | null;
  canWrite: boolean;
  canPublish: boolean;
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
}

export default function Panels({ storyId, nodeId, myRole, canWrite, canPublish, tab, onTabChange }: PanelsProps) {
  return (
    <div className="panels">
      <div className="tabs">
        {PANEL_TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => onTabChange(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'characters' && <CharactersPanel storyId={storyId} nodeId={nodeId} canWrite={canWrite} />}
      {tab === 'lore' && <LorePanel storyId={storyId} nodeId={nodeId} canWrite={canWrite} />}
      {tab === 'members' && <MembersPanel storyId={storyId} canWrite={myRole === 'OWNER'} />}
      {tab === 'releases' && <ReleasesPanel storyId={storyId} canPublish={canPublish} />}
    </div>
  );
}