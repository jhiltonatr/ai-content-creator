import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { api } from '../api/client';
import {
  analyzeProse,
  filterFindingsToVisible,
  mapFindingsToPositions,
  type AiFinding,
} from '../lib/ai/analyze';
import { setAiFindings } from '../lib/ai/highlight';
import { selectVisibleBlocks } from '../lib/ai/viewport';
import type { MentionItem } from '../lib/mentionSync';

const ANALYSIS_DEBOUNCE_MS = 3000;

interface UseAiAnalysisArgs {
  editor: Editor | null;
  editorRef: MutableRefObject<Editor | null>;
  mentionsRef: MutableRefObject<MentionItem[]>;
  storyId?: number;
  nodeId?: number;
}

export function useAiAnalysis({
  editor,
  editorRef,
  mentionsRef,
  storyId,
  nodeId,
}: UseAiAnalysisArgs) {
  const [aiOn, setAiOn] = useState(true);
  const [findings, setFindings] = useState<AiFinding[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const aiOnRef = useRef(aiOn);
  useEffect(() => {
    aiOnRef.current = aiOn;
  }, [aiOn]);
  const analyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);

  const runAnalysis = useCallback(
    (e: Editor) => {
      const context = {
        characters: mentionsRef.current.filter((m) => m.type === 'character').map((m) => m.label),
        lore: mentionsRef.current.filter((m) => m.type === 'lore').map((m) => m.label),
      };
      const fallback = (hits: AiFinding[]) => {
        setFindings(hits);
        const target = editorRef.current ?? e;
        if (!target.isDestroyed) setAiFindings(target, hits);
      };
      if (analysisAbortRef.current) {
        analysisAbortRef.current.abort();
      }
      const selection = selectVisibleBlocks(e);
      if (storyId === undefined || nodeId === undefined) {
        fallback(
          filterFindingsToVisible(analyzeProse(e.state.doc, context), e.state.doc, selection.visibleNonBlank),
        );
        return;
      }
      const sentDoc = e.state.doc;
      const controller = new AbortController();
      analysisAbortRef.current = controller;
      setAnalyzing(true);
      api
        .analyzeNode(storyId, nodeId, selection.trimDoc, controller.signal)
        .then((response) => {
          if (controller.signal.aborted || !aiOnRef.current) return;
          const target = editorRef.current ?? e;
          if (target.isDestroyed) return;
          if (!sentDoc.eq(target.state.doc)) return;
          const hits = mapFindingsToPositions(target.state.doc, response, selection.visibleNonBlank);
          setFindings(hits);
          setAiFindings(target, hits);
          setAnalyzing(false);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return;
          const target = editorRef.current ?? e;
          if (!target.isDestroyed) {
            const currentSelection = selectVisibleBlocks(target);
            fallback(
              filterFindingsToVisible(
                analyzeProse(target.state.doc, context),
                target.state.doc,
                currentSelection.visibleNonBlank,
              ),
            );
          }
          setAnalyzing(false);
        });
    },
    [storyId, nodeId, editorRef, mentionsRef],
  );

  const scheduleAnalysis = useCallback(
    (e: Editor) => {
      if (!aiOnRef.current) return;
      if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
      analyzeTimerRef.current = setTimeout(() => runAnalysis(e), ANALYSIS_DEBOUNCE_MS);
    },
    [runAnalysis],
  );

  const toggleAi = useCallback(() => {
    setAiOn((prev) => {
      const next = !prev;
      const current = editorRef.current;
      if (current) {
        if (next) {
          runAnalysis(current);
        } else {
          if (analysisAbortRef.current) analysisAbortRef.current.abort();
          setAnalyzing(false);
          setAiFindings(current, []);
          setFindings([]);
        }
      }
      return next;
    });
  }, [editorRef, runAnalysis]);

  useEffect(() => {
    if (editor && aiOnRef.current) {
      const t = setTimeout(() => runAnalysis(editor), 0);
      return () => clearTimeout(t);
    }
  }, [editor, runAnalysis]);

  useEffect(
    () => () => {
      if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
      if (analysisAbortRef.current) analysisAbortRef.current.abort();
    },
    [],
  );

  return { aiOn, findings, analyzing, runAnalysis, scheduleAnalysis, toggleAi };
}