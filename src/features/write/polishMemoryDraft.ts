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

export function polishGuidedMemoryDraftLocally(draft: GuidedMemoryDraft) {
  const composed = normalizeFragment(draft.composedText);
  const original = normalizeFragment(draft.originalAnswer);
  const base = composed || original;

  if (!base) {
    return "";
  }

  const firstSentence = ensureSentenceEnding(ensureSentenceCase(base));

  return firstSentence;
}
