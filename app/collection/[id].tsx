import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FadeInView } from "@/components/FadeInView";
import { MemoryCard } from "@/components/MemoryCard";
import { useMemoryService } from "@/services/memoryService";
import { theme } from "@/theme/theme";
import type { Memory, MemoryCollection } from "@/types/memory";

function getCollectionKindLabel(kind: MemoryCollection["kind"]) {
  switch (kind) {
    case "vacation":
      return "Vacation";
    case "school_year":
      return "School Year";
    case "holiday":
      return "Holiday";
    case "kid_chapter":
      return "Kid Chapter";
    default:
      return "Collection";
  }
}

function formatCollectionDateRange(collection: MemoryCollection) {
  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;

  const startLabel = formatDate(collection.startDate);
  const endLabel = formatDate(collection.endDate);

  if (startLabel && endLabel) {
    return `${startLabel} to ${endLabel}`;
  }

  return startLabel ?? endLabel ?? "A longer family chapter";
}

export default function CollectionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const collectionId = typeof params.id === "string" ? params.id : "";
  const { getCollectionById, getMemoriesForCollection } = useMemoryService();
  const [collection, setCollection] = useState<MemoryCollection | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadCollection = useCallback(async () => {
    if (!collectionId) {
      setCollection(null);
      setMemories([]);
      setErrorMessage("Missing collection id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const [nextCollection, nextMemories] = await Promise.all([
        getCollectionById(collectionId),
        getMemoriesForCollection(collectionId),
      ]);

      if (!nextCollection) {
        setCollection(null);
        setMemories([]);
        setErrorMessage("That collection could not be found.");
        return;
      }

      setCollection(nextCollection);
      setMemories(nextMemories);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load the collection.");
    } finally {
      setIsLoading(false);
    }
  }, [collectionId, getCollectionById, getMemoriesForCollection]);

  useFocusEffect(
    useCallback(() => {
      void loadCollection();
    }, [loadCollection])
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.stateText}>Loading collection...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <FadeInView>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.eyebrow}>
              {collection ? getCollectionKindLabel(collection.kind) : "Collection"}
            </Text>
            <Text style={styles.title}>
              {collection?.title ?? "Collection not found"}
            </Text>
            <Text style={styles.subtitle}>
              {collection
                ? collection.description?.trim() ||
                  "A bigger chapter in your family archive, gathered into one place."
                : "This archive chapter is no longer available."}
            </Text>
          </View>
        </FadeInView>

        {errorMessage ? (
          <FadeInView delay={80}>
            <View style={styles.stateCard}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          </FadeInView>
        ) : null}

        {collection ? (
          <>
            <FadeInView delay={90}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{collection.memoryCount}</Text>
                    <Text style={styles.metricLabel}>Memories</Text>
                  </View>
                  <View style={styles.metricCardWide}>
                    <Text style={styles.metricCaption}>Date range</Text>
                    <Text style={styles.metricWideValue}>
                      {formatCollectionDateRange(collection)}
                    </Text>
                  </View>
                </View>
              </View>
            </FadeInView>

            <FadeInView delay={110}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Memories in this chapter</Text>
                <Text style={styles.sectionHint}>
                  Browse the moments that belong to this longer stretch of life.
                </Text>
              </View>
            </FadeInView>

            {memories.length ? (
              <View style={styles.list}>
                {memories.map((memory, index) => (
                  <FadeInView key={memory.id} delay={130 + index * 35} distance={10}>
                    <MemoryCard memory={memory} />
                  </FadeInView>
                ))}
              </View>
            ) : (
              <FadeInView delay={130}>
                <View style={styles.stateCard}>
                  <Text style={styles.stateText}>
                    This collection exists, but it does not have any memories in it yet.
                  </Text>
                </View>
              </FadeInView>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  centered: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.sm,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  content: {
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  header: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: "#FBF1E6",
    borderColor: "#E7D2BE",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  metricCard: {
    backgroundColor: "#FFF9F3",
    borderColor: "#E7D7C8",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: 2,
    minWidth: 110,
    padding: theme.spacing.md,
  },
  metricCardWide: {
    backgroundColor: "#FFF9F3",
    borderColor: "#E7D7C8",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 160,
    padding: theme.spacing.md,
  },
  metricValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "600",
  },
  metricCaption: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  metricWideValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
    lineHeight: 22,
  },
  sectionHeader: {
    gap: theme.spacing.xs,
  },
  sectionLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  sectionHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
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
