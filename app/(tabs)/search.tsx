import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { MemoryCard } from "@/components/MemoryCard";
import { useMemoryService } from "@/services/memoryService";
import { theme } from "@/theme/theme";
import type { Memory } from "@/types/memory";

export default function SearchScreen() {
  const { getMemories, searchMemories } = useMemoryService();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function runSearch() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const nextResults = query.trim()
          ? await searchMemories(query)
          : await getMemories();

        if (isActive) {
          setResults(nextResults);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : "Could not search memories.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void runSearch();

    return () => {
      isActive = false;
    };
  }, [getMemories, query, searchMemories]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Find a memory</Text>
        <Text style={styles.subtitle}>
          Search saved memories by text, prompt, tags, or attached photo reference path.
        </Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search memories..."
        placeholderTextColor={theme.colors.textSoft}
        style={styles.searchInput}
      />

      {isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.stateText}>Searching memories...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.resultCount}>
            {results.length} {results.length === 1 ? "memory" : "memories"}
          </Text>

          <View style={styles.list}>
            {results.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} />
            ))}
            {!results.length ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateText}>
                  No memories matched. Try a different word, tag, or date fragment.
                </Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  header: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.hero,
    fontWeight: "700",
    lineHeight: 38,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
  },
  searchInput: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  resultCount: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "600",
  },
  list: {
    gap: theme.spacing.md,
  },
  stateCard: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  stateText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    textAlign: "center",
  },
  errorText: {
    color: "#B44D47",
    fontSize: theme.typography.body,
    textAlign: "center",
  },
});
