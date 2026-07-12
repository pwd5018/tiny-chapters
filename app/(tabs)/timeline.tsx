import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { FadeInView } from "@/components/FadeInView";
import { MemoryCard } from "@/components/MemoryCard";
import { ScreenHero } from "@/components/ScreenHero";
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
  if (!collection.startDate && !collection.endDate) {
    return getCollectionKindLabel(collection.kind);
  }

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  const startLabel = formatDate(collection.startDate);
  const endLabel = formatDate(collection.endDate);

  if (startLabel && endLabel) {
    return `${getCollectionKindLabel(collection.kind)} | ${startLabel} to ${endLabel}`;
  }

  return `${getCollectionKindLabel(collection.kind)} | ${startLabel ?? endLabel}`;
}

function CollectionCard({ collection }: { collection: MemoryCollection }) {
  const router = useRouter();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.collectionCard,
        pressed ? styles.collectionCardPressed : null,
      ]}
      onPress={() => router.push(`/collection/${collection.id}` as never)}
    >
      <View style={styles.collectionHeader}>
        <View style={styles.collectionHeaderCopy}>
          <Text style={styles.collectionKind}>{getCollectionKindLabel(collection.kind)}</Text>
          <Text style={styles.collectionTitle}>{collection.title}</Text>
        </View>
        <View style={styles.collectionCountPill}>
          <Text style={styles.collectionCountText}>
            {collection.memoryCount} {collection.memoryCount === 1 ? "memory" : "memories"}
          </Text>
        </View>
      </View>
      <Text style={styles.collectionMeta}>{formatCollectionDateRange(collection)}</Text>
      <Text style={styles.collectionDescription}>
        {collection.description?.trim() ||
          "Open this chapter to browse the memories gathered into this longer stretch of family life."}
      </Text>
      <View style={styles.collectionFooter}>
        <View style={styles.collectionFooterRule} />
        <Text style={styles.collectionFooterText}>Open collection</Text>
      </View>
    </Pressable>
  );
}

export default function TimelineScreen() {
  const { getMemories, getMemoryStats, getCollections } = useMemoryService();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [collections, setCollections] = useState<MemoryCollection[]>([]);
  const [stats, setStats] = useState({
    totalMemories: 0,
    totalPhotoRefs: 0,
    thisMonthMemories: 0,
    currentStreak: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadMemories = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [nextMemories, nextStats, nextCollections] = await Promise.all([
        getMemories(),
        getMemoryStats(),
        getCollections(),
      ]);
      setMemories(nextMemories);
      setStats(nextStats);
      setCollections(nextCollections);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load memories.");
    } finally {
      setIsLoading(false);
    }
  }, [getCollections, getMemories, getMemoryStats]);

  useFocusEffect(
    useCallback(() => {
      void loadMemories();
    }, [loadMemories])
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <FadeInView>
        <ScreenHero
          eyebrow="Moments"
          title="A warmer archive of the moments you have already kept."
          subtitle="Stats, recent saves, and the running story of your family life live here instead of crowding the Today screen."
          orbLargeColor="#E6D7C4"
          orbSmallColor="#DCC7B2"
        />
      </FadeInView>

      {isLoading ? (
        <FadeInView delay={80}>
          <View style={styles.stateCard}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.stateText}>Loading memories...</Text>
          </View>
        </FadeInView>
      ) : errorMessage ? (
        <FadeInView delay={80}>
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        </FadeInView>
      ) : (
        <FadeInView delay={90}>
          <View style={styles.list}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryHeaderCopy}>
                  <Text style={styles.summaryEyebrow}>Your rhythm</Text>
                  <Text style={styles.summaryTitle}>A quick pulse on your archive</Text>
                </View>
                <Text style={styles.summaryNote}>
                  Small, steady memories add up.
                </Text>
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{stats.totalMemories}</Text>
                  <Text style={styles.metricLabel}>Memories</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{stats.thisMonthMemories}</Text>
                  <Text style={styles.metricLabel}>This month</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{stats.currentStreak}</Text>
                  <Text style={styles.metricLabel}>Streak</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{collections.length}</Text>
                  <Text style={styles.metricLabel}>Collections</Text>
                </View>
              </View>
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Collections</Text>
              <Text style={styles.sectionHint}>
                Larger chapters like trips, school years, holidays, and kid-specific seasons now have a home here.
              </Text>
            </View>
            {collections.length ? (
              <View style={styles.collectionList}>
                {collections.map((collection, index) => (
                  <FadeInView key={collection.id} delay={100 + index * 35} distance={10}>
                    <CollectionCard collection={collection} />
                  </FadeInView>
                ))}
              </View>
            ) : (
              <View style={styles.stateCard}>
                <Text style={styles.stateText}>
                  No collections yet. The archive is ready for them whenever you start grouping memories into bigger chapters.
                </Text>
              </View>
            )}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Recent Chapters</Text>
              <Text style={styles.sectionHint}>
                A softer browse through the small moments you have already kept.
              </Text>
            </View>
            {memories.map((memory, index) => (
              <FadeInView key={memory.id} delay={120 + index * 40} distance={10}>
                <MemoryCard memory={memory} />
              </FadeInView>
            ))}
            {!memories.length ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateText}>No memories yet. Save one from Write.</Text>
              </View>
            ) : null}
          </View>
        </FadeInView>
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
  list: {
    gap: theme.spacing.md,
  },
  summaryCard: {
    backgroundColor: "#FBF1E6",
    borderColor: "#E7D2BE",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  summaryHeader: {
    gap: theme.spacing.sm,
  },
  summaryHeaderCopy: {
    gap: 2,
  },
  summaryEyebrow: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  summaryTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  summaryNote: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  sectionHeader: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
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
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  metricCard: {
    backgroundColor: "#FFF9F3",
    borderColor: "#E7D7C8",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 90,
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
  collectionList: {
    gap: theme.spacing.md,
  },
  collectionCard: {
    backgroundColor: "#FFF8F1",
    borderColor: "#E8D7C6",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  collectionCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.993 }],
  },
  collectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  collectionHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  collectionKind: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  collectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  collectionCountPill: {
    backgroundColor: "#F5E7D9",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  collectionCountText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  collectionMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  collectionDescription: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 24,
  },
  collectionFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  collectionFooterRule: {
    backgroundColor: "#E7D9CB",
    flex: 1,
    height: 1,
    marginRight: theme.spacing.sm,
  },
  collectionFooterText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.2,
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
