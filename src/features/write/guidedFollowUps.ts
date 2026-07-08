import type { GuidedMemoryDraft } from "@/types/memory";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function uniqueQuestions(questions: string[]) {
  return [...new Set(questions.map((question) => question.trim()))].filter(Boolean);
}

export function generateLocalGuidedFollowUpQuestions(
  baseQuestion: string,
  originalAnswer: string
) {
  const normalizedAnswer = normalizeText(originalAnswer);
  const normalizedQuestion = normalizeText(baseQuestion);
  const questions: string[] = [];

  if (!normalizedAnswer) {
    return questions;
  }

  if (/(laugh|laughed|giggle|funny|joke|smile)/.test(normalizedAnswer)) {
    questions.push("What exactly made everyone laugh in that moment?");
  } else if (/(said|asked|told|whispered|yelled)/.test(normalizedAnswer)) {
    questions.push("What were the exact words or the closest version you want to remember?");
  } else {
    questions.push("What tiny detail would you want your future self to picture here?");
  }

  if (/(kid|kids|daughter|son|mom|dad|family|we|our|he|she|they)/.test(normalizedAnswer)) {
    questions.push("How did someone in your family react while this was happening?");
  } else {
    questions.push("How did this moment feel while it was happening?");
  }

  if (normalizedQuestion.includes("worth remembering")) {
    questions.push("Why did this feel worth saving instead of letting it blur into the day?");
  } else if (normalizedQuestion.includes("sad to forget")) {
    questions.push("What part of this would feel most disappointing to lose later?");
  } else {
    questions.push("What part of this do you most want to hold onto later?");
  }

  return uniqueQuestions(questions).slice(0, 3);
}

export function composeGuidedMemoryText(draft: GuidedMemoryDraft) {
  const sections = [draft.originalAnswer.trim()];
  const answeredFollowUps = draft.followUps
    .filter((followUp) => followUp.status === "answered" && followUp.answer.trim())
    .map((followUp) => followUp.answer.trim());

  if (answeredFollowUps.length) {
    sections.push(...answeredFollowUps);
  }

  return sections.filter(Boolean).join("\n\n").trim();
}
