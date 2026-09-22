export type PanelTab = 'characters' | 'lore' | 'members' | 'releases';

export const PANEL_TABS: { id: PanelTab; label: string }[] = [
  { id: 'characters', label: 'Characters' },
  { id: 'lore', label: 'Lore' },
  { id: 'members', label: 'Members' },
  { id: 'releases', label: 'Releases' },
];