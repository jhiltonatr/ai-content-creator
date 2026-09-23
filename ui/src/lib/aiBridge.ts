export const AI_TOGGLE_EVENT = 'storyforge:ai-toggle';
export const AI_STATE_EVENT = 'storyforge:ai-state';

export interface AiStateDetail {
  on: boolean;
  findings: number;
}

export function emitAiToggle(): void {
  window.dispatchEvent(new CustomEvent(AI_TOGGLE_EVENT));
}

export function emitAiState(state: AiStateDetail): void {
  window.dispatchEvent(new CustomEvent(AI_STATE_EVENT, { detail: state }));
}