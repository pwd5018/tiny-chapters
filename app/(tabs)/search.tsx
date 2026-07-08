import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { FadeInView } from "@/components/FadeInView";
import { MemoryCard } from "@/components/MemoryCard";
import { ScreenHero } from "@/components/ScreenHero";
import { useMemoryService } from "@/services/memoryService";
import { theme } from "@/theme/theme";
import type { Memory } from "@/types/memory";

export default function SearchScreen() {
  const { getMemories, searchMemories } = useMemoryService();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const runSearch = useCallback(() => {
    let isActive = true;

    async function loadResults() {
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

    void loadResults();

    return () => {
      isActive = false;
    };
  }, [getMemories, query, searchMemories]);

  useFocusEffect(runSearch);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FadeInView>
        <ScreenHero
          eyebrow="Search"
          title="Find a memory without digging too hard."
          subtitle="Search saved memories by text, prompt, tags, or attached photo reference path."
          orbLargeColor="#E8D9C8"
          orbSmallColor="#DDBFA7"
        />
      </FadeInView>

      <FadeInView delay={80}>
        <View style={styles.searchShell}>
          <Text style={styles.searchLabel}>Search your archive</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search memories..."
            placeholderTextColor={theme.colors.textSoft}
            style={styles.searchInput}
          />
        </View>
      </FadeInView>

      {isLoading ? (
        <FadeInView delay={130}>
          <View style={styles.stateCard}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.stateText}>Searching memories...</Text>
          </View>
        </FadeInView>
      ) : errorMessage ? (
        <FadeInView delay={130}>
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        </FadeInView>
      ) : (
        <>
          <FadeInView delay={130}>
            <Text style={styles.resultCount}>
              {results.length} {results.length === 1 ? "memory" : "memories"}
            </Text>
          </FadeInView>

          <View style={styles.list}>
            {results.map((memory, index) => (
              <FadeInView key={memory.id} delay={150 + index * 35} distance={10}>
                <MemoryCard memory={memory} />
              </FadeInView>
            ))}
            {!results.length ? (
              <FadeInView delay={150}>
                <View style={styles.stateCard}>
                  <Text style={styles.stateText}>
                    No memories matched. Try a different word, tag, or date fragment.
                  </Text>
                </View>
              </FadeInView>
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
    paddingBottom: theme.spacing.xl * 2,
  },
  searchShell: {
    backgroundColor: "#F6EBDD",
    borderColor: "#E5D2BE",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  searchLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  searchInput: {
    backgroundColor: "#FFF9F3",
    borderColor: "#E7D8C8",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    lineHeight: 22,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  resultCount: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  list: {
    gap: theme.spacing.md,
  },
  stateCard: {
    alignItems: "center",
    backgroundColor: "#FFF8F1",
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
