import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme/theme";
import type { MemoryMetadataSuggestion } from "@/types/memory";

type MemoryMetadataSuggestionsCardProps = {
  isGenerating: boolean;
  isReviewingSuggestionId: string | null;
  suggestions: MemoryMetadataSuggestion[];
  onApprove: (suggestion: MemoryMetadataSuggestion) => void;
  onGenerate: () => void;
  onReject: (suggestion: MemoryMetadataSuggestion) => void;
};

function getFieldLabel(field: MemoryMetadataSuggestion["field"]) {
  switch (field) {
    case "tag":
      return "Tag";
    case "person":
      return "Person";
    case "place":
      return "Place";
    case "project":
      return "Project";
    case "topic":
      return "Topic";
  }
}

export function MemoryMetadataSuggestionsCard({
  isGenerating,
  isReviewingSuggestionId,
  suggestions,
  onApprove,
  onGenerate,
  onReject,
}: MemoryMetadataSuggestionsCardProps) {
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === "pending");

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>AI suggestions</Text>
          <Text style={styles.helper}>
            Tiny Chapters can suggest details from these words and reuse names already confirmed in your archive. Nothing changes until you approve it.
          </Text>
        </View>
        <Pressable
          disabled={isGenerating || Boolean(isReviewingSuggestionId)}
          style={({ pressed }) => [
            styles.generateButton,
            (isGenerating || isReviewingSuggestionId) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={onGenerate}
        >
          {isGenerating ? <ActivityIndicator color={theme.colors.buttonText} /> : null}
          <Text style={styles.generateButtonText}>
            {isGenerating ? "Thinking..." : pendingSuggestions.length ? "Refresh suggestions" : "Suggest details"}
          </Text>
        </Pressable>
      </View>

      {pendingSuggestions.length ? (
        <View style={styles.suggestionList}>
          {pendingSuggestions.map((suggestion) => {
            const isReviewing = isReviewingSuggestionId === suggestion.id;
            return (
              <View key={suggestion.id} style={styles.suggestionRow}>
                <View style={styles.suggestionCopy}>
                  <Text style={styles.fieldLabel}>{getFieldLabel(suggestion.field)}</Text>
                  <Text style={styles.value}>{suggestion.value}</Text>
                  <Text style={styles.note}>
                    {suggestion.matchedValue
                      ? `Matches existing ${getFieldLabel(suggestion.field).toLowerCase()}: ${suggestion.matchedValue}`
                      : `New suggestion · ${suggestion.confidence}% confidence`}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    disabled={Boolean(isReviewingSuggestionId)}
                    style={({ pressed }) => [
                      styles.dismissButton,
                      isReviewing && styles.buttonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => onReject(suggestion)}
                  >
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
                  </Pressable>
                  <Pressable
                    disabled={Boolean(isReviewingSuggestionId)}
                    style={({ pressed }) => [
                      styles.approveButton,
                      isReviewing && styles.buttonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => onApprove(suggestion)}
                  >
                    {isReviewing ? <ActivityIndicator color={theme.colors.buttonText} /> : null}
                    <Text style={styles.approveButtonText}>{isReviewing ? "" : "Approve"}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>
          {suggestions.length
            ? "All current suggestions have been reviewed. Generate again if the chapter changes."
            : "Suggestions stay separate from confirmed details until you choose what belongs."}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F5F0FF",
    borderColor: "#D8CBEF",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  header: {
    gap: theme.spacing.md,
  },
  headerCopy: {
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  helper: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  generateButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#69528B",
    borderRadius: theme.radii.pill,
    flexDirection: "row",
    gap: theme.spacing.xs,
    minHeight: 42,
    paddingHorizontal: theme.spacing.md,
  },
  generateButtonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  suggestionList: {
    gap: theme.spacing.sm,
  },
  suggestionRow: {
    backgroundColor: "#FFFCFF",
    borderColor: "#E0D7EE",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  suggestionCopy: {
    gap: 2,
  },
  fieldLabel: {
    color: "#69528B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  note: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  approveButton: {
    alignItems: "center",
    backgroundColor: "#69528B",
    borderRadius: theme.radii.pill,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 88,
    paddingHorizontal: theme.spacing.md,
  },
  approveButtonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  dismissButton: {
    alignItems: "center",
    borderColor: "#B7A8CC",
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: theme.spacing.md,
  },
  dismissButtonText: {
    color: "#69528B",
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
});
