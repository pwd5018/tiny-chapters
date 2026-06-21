import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { MemoryCard } from "@/components/MemoryCard";
import { useMemoryService } from "@/services/memoryService";
import { theme } from "@/theme/theme";
import type { Memory } from "@/types/memory";

export default function TimelineScreen() {
  const { getMemories } = useMemoryService();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadMemories = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const nextMemories = await getMemories();
      setMemories(nextMemories);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load memories.");
    } finally {
      setIsLoading(false);
    }
  }, [getMemories]);

  useFocusEffect(
    useCallback(() => {
      void loadMemories();
    }, [loadMemories])
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>A timeline of tiny moments</Text>
        <Text style={styles.subtitle}>
          Your most recent memories, with photo references loaded from Supabase.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.stateText}>Loading memories...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {memories.map((memory) => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
          {!memories.length ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateText}>No memories yet. Save one from Today.</Text>
            </View>
          ) : null}
        </View>
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
  },
  errorText: {
    color: "#B44D47",
    fontSize: theme.typography.body,
    textAlign: "center",
  },
});
