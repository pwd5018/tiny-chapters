import { Pressable, StyleSheet, Text, View } from "react-native";

import { getDashboardCardDefinition } from "@/features/dashboard/dashboardCardRegistry";
import type { DashboardCard as DashboardCardModel } from "@/features/dashboard/dashboardTypes";
import { theme } from "@/theme/theme";

type DashboardCardProps = {
  card: DashboardCardModel;
  onActionPress?: (card: DashboardCardModel) => void;
  variant?: "featured" | "default";
};

export function DashboardCard({
  card,
  onActionPress,
  variant = "default",
}: DashboardCardProps) {
  const definition = getDashboardCardDefinition(card.type);
  const description = definition.getDescription?.(card) ?? card.description;
  const isWarm = definition.tone === "warm";
  const isFeatured = variant === "featured";

  return (
    <View
      style={[
        styles.card,
        isWarm ? styles.cardWarm : styles.cardDefault,
        isFeatured ? styles.cardFeatured : null,
      ]}
    >
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, isWarm ? styles.eyebrowWarm : null]}>
          {definition.eyebrow}
        </Text>
        <Text style={[styles.title, isFeatured ? styles.titleFeatured : null]}>{card.title}</Text>
        {card.subtitle ? <Text style={styles.subtitle}>{card.subtitle}</Text> : null}
        {description ? (
          <Text style={[styles.description, isFeatured ? styles.descriptionFeatured : null]}>
            {description}
          </Text>
        ) : null}
        {card.type === "daily_prompt" && card.payload.helperText ? (
          <Text style={styles.helperText}>{card.payload.helperText}</Text>
        ) : null}
      </View>

      {card.type === "on_this_day" && card.payload.state === "ready" ? (
        <View style={styles.memoryList}>
          {card.payload.memories.map((memory) => (
            <View key={memory.id} style={styles.memoryRow}>
              <View style={styles.memoryMetaRow}>
                <Text style={styles.memoryYearLabel}>{memory.yearsAgo} years ago</Text>
                <Text style={styles.memoryPhotoCount}>
                  {memory.photoCount} {memory.photoCount === 1 ? "photo" : "photos"}
                </Text>
              </View>
              <Text style={styles.memoryPrompt} numberOfLines={1}>
                {memory.prompt}
              </Text>
              <Text style={styles.memoryText} numberOfLines={3}>
                {memory.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {card.action ? (
        <Pressable
          style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
          onPress={() => onActionPress?.(card)}
        >
          <Text style={styles.actionText}>{card.action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    shadowColor: "#7C5C4D",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
  },
  cardDefault: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  cardFeatured: {
    backgroundColor: "#FFF3E8",
    borderColor: "#E8D3C0",
    paddingBottom: theme.spacing.xl,
  },
  cardWarm: {
    backgroundColor: theme.colors.cardWarm,
    borderColor: theme.colors.border,
  },
  copy: {
    gap: theme.spacing.xs,
  },
  eyebrow: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  eyebrowWarm: {
    color: theme.colors.accent,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
    lineHeight: 26,
  },
  titleFeatured: {
    fontSize: theme.typography.hero,
    lineHeight: 38,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 24,
  },
  descriptionFeatured: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    lineHeight: 28,
    maxWidth: "92%",
  },
  helperText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  memoryList: {
    gap: theme.spacing.sm,
  },
  memoryRow: {
    backgroundColor: "#FFFBF7",
    borderColor: "#E8DACA",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  memoryMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  memoryYearLabel: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  memoryPhotoCount: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "600",
  },
  memoryPrompt: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  memoryText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  action: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFF7EE",
    borderColor: "#E5D2BD",
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  actionPressed: {
    backgroundColor: "#F8E9D7",
  },
  actionText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
