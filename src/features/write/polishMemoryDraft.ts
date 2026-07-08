import type { GuidedMemoryDraft } from "@/types/memory";

function normalizeFragment(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function ensureSentenceCase(value: string) {
  const trimmed = normalizeFragment(value);

  if (!trimmed) {
    return "";
  }

  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function ensureSentenceEnding(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function compactFollowUpAnswers(draft: GuidedMemoryDraft) {
  return draft.followUps
    .filter((followUp) => followUp.status === "answered" && followUp.answer.trim())
    .map((followUp) => normalizeFragment(followUp.answer));
}

export function polishGuidedMemoryDraftLocally(draft: GuidedMemoryDraft) {
  const original = normalizeFragment(draft.originalAnswer);
  const composed = normalizeFragment(draft.composedText);
  const answeredFollowUps = compactFollowUpAnswers(draft);
  const base = composed || original;

  if (!base) {
    return "";
  }

  const firstSentence = ensureSentenceEnding(ensureSentenceCase(base));

  if (!answeredFollowUps.length) {
    return firstSentence;
  }

  const shortFragments = answeredFollowUps.filter((answer) => answer.split(/\s+/).length <= 4);
  const longFragments = answeredFollowUps.filter((answer) => answer.split(/\s+/).length > 4);

  const detailParts: string[] = [];

  if (shortFragments.length) {
    detailParts.push(`Details I want to keep: ${shortFragments.join(", ")}`);
  }

  if (longFragments.length) {
    detailParts.push(...longFragments);
  }

  const detailSentence = ensureSentenceEnding(
    ensureSentenceCase(detailParts.join(". ").replace(/\.\s+\./g, "."))
  );

  return [firstSentence, detailSentence].filter(Boolean).join(" ");
}
