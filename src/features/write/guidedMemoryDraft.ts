import type {
  GuidedMemoryDraft,
  GuidedMemoryFollowUp,
  MemoryGuidanceContext,
} from "@/types/memory";

function createFollowUpId(order: number) {
  return `follow-up-${order + 1}`;
}

export function createGuidedMemoryDraft(
  baseQuestion: string,
  seedText = ""
): GuidedMemoryDraft {
  return {
    baseQuestion,
    originalAnswer: seedText,
    followUps: [],
    composedText: seedText,
    polishedSuggestion: null,
  };
}

export function syncGuidedMemoryDraftQuestion(
  draft: GuidedMemoryDraft | null,
  baseQuestion: string,
  seedText = ""
): GuidedMemoryDraft {
  if (!draft) {
    return createGuidedMemoryDraft(baseQuestion, seedText);
  }

  if (draft.baseQuestion === baseQuestion) {
    return draft;
  }

  return {
    ...draft,
    baseQuestion,
  };
}

function hasFollowUpProgress(followUps: GuidedMemoryFollowUp[]) {
  return followUps.some(
    (followUp) => followUp.answer.trim().length > 0 || followUp.status === "skipped"
  );
}

export function syncGuidedMemoryDraftFromEditor(
  draft: GuidedMemoryDraft | null,
  value: string
): GuidedMemoryDraft | null {
  if (!draft) {
    return null;
  }

  return {
    ...draft,
    originalAnswer: hasFollowUpProgress(draft.followUps) ? draft.originalAnswer : value,
    composedText: value,
  };
}

export function setGuidedMemoryDraftFollowUpQuestions(
  draft: GuidedMemoryDraft | null,
  questions: string[]
): GuidedMemoryDraft | null {
  if (!draft) {
    return null;
  }

  const existingByQuestion = new Map(
    draft.followUps.map((followUp) => [followUp.question, followUp])
  );

  return {
    ...draft,
    followUps: questions.slice(0, 3).map((question, order) => {
      const existing = existingByQuestion.get(question);

      return (
        existing ?? {
          id: createFollowUpId(order),
          question,
          answer: "",
          order,
          status: "pending",
        }
      );
    }),
  };
}

export function setGuidedMemoryDraftFollowUpAnswer(
  draft: GuidedMemoryDraft | null,
  followUpId: string,
  answer: string
): GuidedMemoryDraft | null {
  if (!draft) {
    return null;
  }

  return {
    ...draft,
    followUps: draft.followUps.map((followUp) =>
      followUp.id === followUpId
        ? {
            ...followUp,
            answer,
            status: answer.trim() ? "answered" : "pending",
          }
        : followUp
    ),
  };
}

export function setGuidedMemoryDraftFollowUpSkipped(
  draft: GuidedMemoryDraft | null,
  followUpId: string
): GuidedMemoryDraft | null {
  if (!draft) {
    return null;
  }

  return {
    ...draft,
    followUps: draft.followUps.map((followUp) =>
      followUp.id === followUpId
        ? {
            ...followUp,
            answer: "",
            status: "skipped",
          }
        : followUp
    ),
  };
}

export function setGuidedMemoryDraftPolishedSuggestion(
  draft: GuidedMemoryDraft | null,
  polishedSuggestion: string | null
): GuidedMemoryDraft | null {
  if (!draft) {
    return null;
  }

  return {
    ...draft,
    polishedSuggestion,
  };
}

export function createMemoryGuidanceContext(
  draft: GuidedMemoryDraft | null
): MemoryGuidanceContext | null {
  if (!draft) {
    return null;
  }

  const hasFollowUps = draft.followUps.length > 0;
  const hasPolishedSuggestion = Boolean(draft.polishedSuggestion?.trim());

  if (!hasFollowUps && !hasPolishedSuggestion) {
    return null;
  }

  return {
    baseQuestion: draft.baseQuestion,
    originalAnswer: draft.originalAnswer.trim(),
    followUps: draft.followUps.map((followUp) => ({
      ...followUp,
      question: followUp.question.trim(),
      answer: followUp.answer.trim(),
    })),
    polishedSuggestion: draft.polishedSuggestion?.trim() || null,
  };
}
