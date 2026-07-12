import { prompts } from "@/data/prompts";

function normalizePrompt(prompt: string) {
  return prompt.trim().toLowerCase();
}

function buildFallbackPromptPool(date: Date) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const month = date.toLocaleDateString(undefined, { month: "long" });

  return [
    ...prompts,
    `What part of ${weekday} felt unexpectedly sweet?`,
    `What do you want ${month} to feel like in hindsight?`,
    "What else happened today that deserves its own tiny chapter?",
    "Which ordinary moment from today would be hardest to recreate later?",
    "What side of your family life showed up today that you want to remember?",
  ];
}

export function generateLocalDailyPrompt(date: Date, priorPrompts: string[]) {
  const usedPrompts = new Set(priorPrompts.map(normalizePrompt).filter(Boolean));
  const promptPool = buildFallbackPromptPool(date);

  if (!usedPrompts.size) {
    const dayKey = Number(
      `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
    );
    return promptPool[dayKey % promptPool.length];
  }

  const firstUnused = promptPool.find((prompt) => !usedPrompts.has(normalizePrompt(prompt)));
  if (firstUnused) {
    return firstUnused;
  }

  return "What else from today feels worth saving before it slips away?";
}
