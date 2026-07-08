import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { FadeInView } from "@/components/FadeInView";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import type { DashboardCard as DashboardCardModel } from "@/features/dashboard/dashboardTypes";
import { theme } from "@/theme/theme";

type DashboardCardListProps = {
  cards: DashboardCardModel[];
  isLoading: boolean;
  errorMessage: string;
  onActionPress?: (card: DashboardCardModel) => void;
};

export function DashboardCardList({
  cards,
  isLoading,
  errorMessage,
  onActionPress,
}: DashboardCardListProps) {
  if (isLoading) {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.stateText}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.stateCard}>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  if (!cards.length) {
    return (
      <View style={styles.stateCard}>
        <Text style={styles.stateText}>No dashboard cards are ready yet.</Text>
      </View>
    );
  }

  const [featuredCard, ...secondaryCards] = cards;

  return (
    <View style={styles.list}>
      <FadeInView delay={40}>
        <View style={styles.section}>
          <View style={styles.headerBlock}>
            <Text style={styles.sectionLabel}>Start Here</Text>
            <Text style={styles.sectionHint}>One small thing is enough.</Text>
          </View>
          <DashboardCard
            key={featuredCard.id}
            card={featuredCard}
            onActionPress={onActionPress}
            variant="featured"
          />
        </View>
      </FadeInView>
      {secondaryCards.length ? (
        <View style={styles.section}>
          <View style={styles.headerBlock}>
            <Text style={styles.sectionLabel}>Earlier Chapters</Text>
            <Text style={styles.sectionHint}>A few things worth revisiting.</Text>
          </View>
          <View style={styles.secondaryList}>
            {secondaryCards.map((card, index) => (
              <FadeInView key={card.id} delay={100 + index * 50}>
                <DashboardCard card={card} onActionPress={onActionPress} />
              </FadeInView>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.md,
  },
  headerBlock: {
    gap: 2,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  secondaryList: {
    gap: theme.spacing.md,
  },
  stateCard: {
    alignItems: "center",
    backgroundColor: "#FFF8F1",
    borderColor: "#E7D8C8",
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
