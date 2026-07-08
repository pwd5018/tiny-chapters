import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { FadeInView } from "@/components/FadeInView";
import { MemoryCard } from "@/components/MemoryCard";
import { ScreenHero } from "@/components/ScreenHero";
import { useMemoryService } from "@/services/memoryService";
import { theme } from "@/theme/theme";
import type { Memory } from "@/types/memory";

export default function TimelineScreen() {
  const { getMemories, getMemoryStats } = useMemoryService();
  const [memories, setMemories] = useState<Memory[]>([]);
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
      const [nextMemories, nextStats] = await Promise.all([
        getMemories(),
        getMemoryStats(),
      ]);
      setMemories(nextMemories);
      setStats(nextStats);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load memories.");
    } finally {
      setIsLoading(false);
    }
  }, [getMemories, getMemoryStats]);

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
              </View>
            </View>
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
