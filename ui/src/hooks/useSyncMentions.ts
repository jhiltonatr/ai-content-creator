import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SYNC_MENTIONS_DONE_EVENT,
  type MentionSyncKind,
  type MentionSyncResult,
  emitSyncMentions,
} from '../lib/mentionSync';

export function useSyncMentions(storyId: number, nodeId: number | null, kind: MentionSyncKind) {
  const [state, setState] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<MentionSyncResult>).detail;
      if (!detail || detail.storyId !== storyId || detail.nodeId !== nodeId || detail.kind !== kind) return;
      setState(
        detail.count > 0
          ? `Replaced ${detail.count} matching mention${detail.count === 1 ? '' : 's'} in the open chapter.`
          : 'No plain-text matches to replace in the open chapter.',
      );
    };
    window.addEventListener(SYNC_MENTIONS_DONE_EVENT, handler);
    return () => window.removeEventListener(SYNC_MENTIONS_DONE_EVENT, handler);
  }, [storyId, nodeId, kind]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setState(null);
  }, [storyId, nodeId, kind]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const sync = useCallback(() => {
    if (!nodeId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState('Syncing…');
    emitSyncMentions({ storyId, nodeId, kind });
    timerRef.current = setTimeout(() => {
      setState((prev) => (prev === 'Syncing…' ? null : prev));
    }, 3000);
  }, [storyId, nodeId, kind]);

  return { state, syncing: state === 'Syncing…', sync };
}