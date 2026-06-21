import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme/theme";

export function DailyPromptCard({ prompt }: { prompt: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Daily prompt</Text>
      <Text style={styles.prompt}>{prompt}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cardWarm,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  label: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  prompt: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "600",
    lineHeight: 28,
  },
});
