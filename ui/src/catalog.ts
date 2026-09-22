export const CATALOG_CHANGED_EVENT = 'storyforge:catalog-changed';

export function emitCatalogChanged(storyId: number): void {
  window.dispatchEvent(new CustomEvent(CATALOG_CHANGED_EVENT, { detail: { storyId } }));
}