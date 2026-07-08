import { createContext, ReactNode, useContext, useMemo, useState } from "react";

import {
  createGuidedMemoryDraft,
  setGuidedMemoryDraftFollowUpAnswer,
  setGuidedMemoryDraftFollowUpQuestions,
  setGuidedMemoryDraftFollowUpSkipped,
  setGuidedMemoryDraftPolishedSuggestion,
  syncGuidedMemoryDraftFromEditor,
  syncGuidedMemoryDraftQuestion,
} from "@/features/write/guidedMemoryDraft";
import { toLocalDateKey } from "@/lib/dates";
import type { GuidedMemoryDraft } from "@/types/memory";

type WriteDraftContextValue = {
  memoryText: string;
  selectedDateKey: string;
  guidedMemoryDraft: GuidedMemoryDraft | null;
  setMemoryText: (value: string) => void;
  setSelectedDateKey: (value: string) => void;
  ensureGuidedMemoryDraft: (baseQuestion: string) => void;
  setGuidedFollowUpQuestions: (questions: string[]) => void;
  setGuidedFollowUpAnswer: (followUpId: string, answer: string) => void;
  skipGuidedFollowUp: (followUpId: string) => void;
  setGuidedPolishedSuggestion: (value: string | null) => void;
  clearDraft: () => void;
};

const WriteDraftContext = createContext<WriteDraftContextValue | null>(null);

export function WriteDraftProvider({ children }: { children: ReactNode }) {
  const [memoryText, setMemoryText] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState(toLocalDateKey(new Date()));
  const [guidedMemoryDraft, setGuidedMemoryDraft] = useState<GuidedMemoryDraft | null>(
    null
  );

  const value = useMemo<WriteDraftContextValue>(
    () => ({
      memoryText,
      selectedDateKey,
      guidedMemoryDraft,
      setMemoryText: (value) => {
        setMemoryText(value);
        setGuidedMemoryDraft((current) => syncGuidedMemoryDraftFromEditor(current, value));
      },
      setSelectedDateKey,
      ensureGuidedMemoryDraft: (baseQuestion) => {
        setGuidedMemoryDraft((current) =>
          syncGuidedMemoryDraftQuestion(current, baseQuestion, memoryText)
        );
      },
      setGuidedFollowUpQuestions: (questions) => {
        setGuidedMemoryDraft((current) =>
          setGuidedMemoryDraftFollowUpQuestions(current, questions)
        );
      },
      setGuidedFollowUpAnswer: (followUpId, answer) => {
        setGuidedMemoryDraft((current) =>
          setGuidedMemoryDraftFollowUpAnswer(current, followUpId, answer)
        );
      },
      skipGuidedFollowUp: (followUpId) => {
        setGuidedMemoryDraft((current) =>
          setGuidedMemoryDraftFollowUpSkipped(current, followUpId)
        );
      },
      setGuidedPolishedSuggestion: (value) => {
        setGuidedMemoryDraft((current) =>
          setGuidedMemoryDraftPolishedSuggestion(current, value)
        );
      },
      clearDraft: () => {
        setMemoryText("");
        setSelectedDateKey(toLocalDateKey(new Date()));
        setGuidedMemoryDraft(null);
      },
    }),
    [guidedMemoryDraft, memoryText, selectedDateKey]
  );

  return (
    <WriteDraftContext.Provider value={value}>
      {children}
    </WriteDraftContext.Provider>
  );
}

export function useWriteDraft() {
  const context = useContext(WriteDraftContext);

  if (!context) {
    throw new Error("useWriteDraft must be used inside WriteDraftProvider");
  }

  return context;
}
