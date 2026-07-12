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

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(Math.round(durationMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatCompactDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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
  lines.push(`Media references: ${payload.summary.totalPhotoReferences}`);
  lines.push(`Print-ready memories: ${payload.printReadinessSummary.readyMemoryCount}`);
  lines.push(`Needs media attention: ${payload.printReadinessSummary.memoriesRequiringPhotoAttentionCount}`);
  lines.push("");
  lines.push("## Book Builder Summary");
  lines.push("");
  lines.push(
    `- Date span: ${
      payload.dateRangeSummary.earliestMemoryDate && payload.dateRangeSummary.latestMemoryDate
        ? `${formatCompactDate(payload.dateRangeSummary.earliestMemoryDate)} to ${formatCompactDate(payload.dateRangeSummary.latestMemoryDate)}`
        : "No memories in this export"
    }`
  );
  lines.push(`- Distinct years: ${payload.dateRangeSummary.distinctYearCount}`);
  lines.push(
    `- Print readiness: ${payload.printReadinessSummary.readyMemoryCount} ready, ${payload.printReadinessSummary.partialMemoryCount} partial, ${payload.printReadinessSummary.textOnlyMemoryCount} text only, ${payload.printReadinessSummary.needsAttentionMemoryCount} need attention`
  );
  lines.push(
    `- Durable media coverage: ${payload.printReadinessSummary.memoriesWithDurablePhotosCount} memories include at least one NAS-linked media reference`
  );
  lines.push(
    `- Media mix: ${payload.mediaSummary.photoReferenceCount} photos, ${payload.mediaSummary.videoReferenceCount} videos, ${payload.mediaSummary.voiceReferenceCount} voice notes`
  );
  lines.push(
    `- Preview coverage: ${payload.mediaSummary.referencesWithPosterPreviewCount} refs with poster previews, ${payload.mediaSummary.referencesWithLocalPreviewCount} refs with local-device previews`
  );
  lines.push(
    `- Media risk review: ${payload.pendingNasMatchRefs.length} pending NAS matches, ${payload.missingPhotoRefs.length} missing archive refs, ${payload.summary.localOnlyPhotoCount} local-only refs`
  );

  if (payload.tagSummary.uniqueTags.length) {
    lines.push(
      `- Exported tags: ${payload.tagSummary.uniqueTags
        .map((tag) => `\`${escapeMarkdown(tag)}\``)
        .join(", ")}`
    );
  } else {
    lines.push("- Exported tags: none");
  }

  if (payload.collectionSummary.collectionCount) {
    lines.push(
      `- Collections: ${Object.entries(payload.collectionSummary.collectionFrequency)
        .map(([title, count]) => `${escapeMarkdown(title)} (${count})`)
        .join(", ")}`
    );
  } else {
    lines.push("- Collections: none");
  }

  lines.push("");
  lines.push("## Archive Notes");
  lines.push("");
  lines.push("- This export includes saved memories plus attached media reference metadata.");
  lines.push("- Tiny Chapters does not bundle the original photo or video files in this archive.");
  lines.push("- The print-readiness fields are meant to help a later local companion workflow find safe book candidates faster.");
  lines.push("- Pending, local-only, or missing media references may still need NAS or local-library resolution later.");

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
      lines.push(`**Book status:** ${escapeMarkdown(memory.printReadinessLabel)}`);
      lines.push("");
      lines.push(memory.printReadinessNote.trim());
      lines.push("");
      lines.push(`**Prompt:** ${escapeMarkdown(memory.prompt)}`);
      lines.push("");
      lines.push(memory.text.trim() ? memory.text : "_No memory text saved._");

      if (memory.tags.length) {
        lines.push("");
        lines.push(`**Tags:** ${memory.tags.map((tag) => `\`${escapeMarkdown(tag)}\``).join(", ")}`);
      }

      if (memory.collections.length) {
        lines.push("");
        lines.push(
          `**Collections:** ${memory.collections
            .map((collection) => `\`${escapeMarkdown(collection.title)}\``)
            .join(", ")}`
        );
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
        lines.push("**Attached media**");
        lines.push("");

        for (const photo of memory.photoManifest) {
          const photoName = photo.filename?.trim() || photo.photoId;
          lines.push(
            `- ${escapeMarkdown(photoName)} [${escapeMarkdown(photo.mediaKind)}] (${escapeMarkdown(photo.syncStatusLabel)})`
          );
          lines.push(`  Source: ${escapeMarkdown(photo.sourceLabel)}`);
          lines.push(`  Reference path: ${escapeMarkdown(photo.path)}`);
          lines.push(`  Note: ${escapeMarkdown(photo.statusNote)}`);

          if (photo.takenAt) {
            lines.push(`  Taken: ${escapeMarkdown(formatTimestamp(photo.takenAt))}`);
          }

          if (photo.contentHash) {
            lines.push(`  Content hash: \`${escapeMarkdown(photo.contentHash)}\``);
          }

          if (photo.durationMs) {
            lines.push(`  Duration: ${escapeMarkdown(formatDuration(photo.durationMs))}`);
          }

          if (photo.mimeType) {
            lines.push(`  MIME type: ${escapeMarkdown(photo.mimeType)}`);
          }

          if (photo.mediaKind !== "photo") {
            lines.push(
              `  Preview coverage: ${photo.posterPathIncluded ? "poster available" : "no poster yet"}${photo.localUriIncluded ? "; local device preview metadata present" : ""}`
            );
          }
        }
      }
    }
  }

  if (payload.pendingNasMatchRefs.length) {
    lines.push("");
    lines.push("## Pending NAS Match Review");
    lines.push("");

    for (const ref of payload.pendingNasMatchRefs) {
      const photoName = ref.filename?.trim() || ref.photoId;
      lines.push(
        `- ${escapeMarkdown(photoName)} from ${escapeMarkdown(formatCompactDate(ref.memoryDate))} (${escapeMarkdown(ref.memoryPrompt)})`
      );
      lines.push(`  Path: ${escapeMarkdown(ref.path)}`);
      lines.push(`  Note: ${escapeMarkdown(ref.statusNote)}`);
    }
  }

  if (payload.missingPhotoRefs.length) {
    lines.push("");
    lines.push("## Missing Archive Photo Review");
    lines.push("");

    for (const ref of payload.missingPhotoRefs) {
      const photoName = ref.filename?.trim() || ref.photoId;
      lines.push(
        `- ${escapeMarkdown(photoName)} from ${escapeMarkdown(formatCompactDate(ref.memoryDate))} (${escapeMarkdown(ref.memoryPrompt)})`
      );
      lines.push(`  Path: ${escapeMarkdown(ref.path)}`);
      lines.push(`  Note: ${escapeMarkdown(ref.statusNote)}`);
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
