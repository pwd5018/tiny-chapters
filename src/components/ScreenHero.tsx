import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme/theme";

type ScreenHeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  orbLargeColor: string;
  orbSmallColor: string;
  children?: ReactNode;
};

export function ScreenHero({
  eyebrow,
  title,
  subtitle,
  orbLargeColor,
  orbSmallColor,
  children,
}: ScreenHeroProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.heroOrbLarge, { backgroundColor: orbLargeColor }]} />
      <View style={[styles.heroOrbSmall, { backgroundColor: orbSmallColor }]} />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    overflow: "hidden",
    padding: theme.spacing.lg,
    position: "relative",
    gap: theme.spacing.lg,
  },
  heroOrbLarge: {
    borderRadius: 999,
    height: 180,
    opacity: 0.42,
    position: "absolute",
    right: -48,
    top: -28,
    width: 180,
  },
  heroOrbSmall: {
    borderRadius: 999,
    height: 90,
    opacity: 0.3,
    position: "absolute",
    right: 24,
    top: 116,
    width: 90,
  },
  header: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
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
    maxWidth: "92%",
  },
});
