import type { MemoryArchiveExport, MemoryExportEntry } from "@/types/export";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeMarkdown(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/([*_`])/g, "\\$1");
}

function groupMemoriesByYear(memories: MemoryExportEntry[]) {
  const grouped = new Map<string, MemoryExportEntry[]>();

  for (const memory of memories) {
    const year = new Date(memory.date).getFullYear().toString();
    const current = grouped.get(year) ?? [];
    current.push(memory);
    grouped.set(year, current);
  }

  return [...grouped.entries()].sort(([left], [right]) => Number(right) - Number(left));
}

export function formatMemoryArchiveAsJson(payload: MemoryArchiveExport) {
  return JSON.stringify(payload, null, 2);
}

export function formatMemoryArchiveAsMarkdown(payload: MemoryArchiveExport) {
  const lines: string[] = [];

  lines.push("# Tiny Chapters Archive");
  lines.push("");
  lines.push(`Exported: ${formatTimestamp(payload.exportedAt)}`);
  lines.push(`Memories: ${payload.summary.memoryCount}`);
  lines.push(`Photo references: ${payload.summary.totalPhotoReferences}`);
  lines.push("");
  lines.push("## Archive Notes");
  lines.push("");
  lines.push("- This export includes saved memories plus attached-photo reference metadata.");
  lines.push("- Tiny Chapters does not bundle the original photo files in this archive.");
  lines.push("- Pending or missing photo references may still need NAS or local-library resolution later.");

  if (payload.filters.from || payload.filters.to || payload.filters.tags.length) {
    lines.push("");
    lines.push("## Applied Filters");
    lines.push("");
    lines.push(`- From: ${payload.filters.from ?? "Any date"}`);
    lines.push(`- To: ${payload.filters.to ?? "Any date"}`);
    lines.push(
      `- Tags: ${payload.filters.tags.length ? payload.filters.tags.join(", ") : "All tags"}`
    );
  }

  for (const [year, memories] of groupMemoriesByYear(payload.memories)) {
    lines.push("");
    lines.push(`## ${year}`);

    for (const memory of memories) {
      lines.push("");
      lines.push(`### ${escapeMarkdown(formatDate(memory.date))}`);
      lines.push("");
      lines.push(`**Prompt:** ${escapeMarkdown(memory.prompt)}`);
      lines.push("");
      lines.push(memory.text.trim() ? memory.text : "_No memory text saved._");

      if (memory.tags.length) {
        lines.push("");
        lines.push(`**Tags:** ${memory.tags.map((tag) => `\`${escapeMarkdown(tag)}\``).join(", ")}`);
      }

      if (memory.guidedContext) {
        lines.push("");
        lines.push("**Guided context**");
        lines.push("");
        lines.push(`- Base question: ${escapeMarkdown(memory.guidedContext.baseQuestion)}`);
        lines.push(`- Original answer: ${escapeMarkdown(memory.guidedContext.originalAnswer)}`);

        for (const followUp of memory.guidedContext.followUps) {
          lines.push(
            `- Follow-up ${followUp.order + 1}: ${escapeMarkdown(followUp.question)}`
          );
          lines.push(
            `  Status: ${escapeMarkdown(followUp.status)}${followUp.answer ? `; Answer: ${escapeMarkdown(followUp.answer)}` : ""}`
          );
        }

        if (memory.guidedContext.polishedSuggestion?.trim()) {
          lines.push(
            `- Polished suggestion: ${escapeMarkdown(memory.guidedContext.polishedSuggestion)}`
          );
        }
      }

      if (memory.photoManifest.length) {
        lines.push("");
        lines.push("**Attached photos**");
        lines.push("");

        for (const photo of memory.photoManifest) {
          const photoName = photo.filename?.trim() || photo.photoId;
          lines.push(`- ${escapeMarkdown(photoName)} (${escapeMarkdown(photo.syncStatusLabel)})`);
          lines.push(`  Source: ${escapeMarkdown(photo.sourceLabel)}`);
          lines.push(`  Reference path: ${escapeMarkdown(photo.path)}`);

          if (photo.takenAt) {
            lines.push(`  Taken: ${escapeMarkdown(formatTimestamp(photo.takenAt))}`);
          }

          if (photo.contentHash) {
            lines.push(`  Content hash: \`${escapeMarkdown(photo.contentHash)}\``);
          }
        }
      }
    }
  }

  if (!payload.memories.length) {
    lines.push("");
    lines.push("## No Memories");
    lines.push("");
    lines.push("No memories matched the current export filters.");
  }

  lines.push("");
  return lines.join("\n");
}
