import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  getActivePhotoSourceMode,
  getNasPhotoApiBaseUrl,
  getNasPhotoApiKeyConfigured,
  testPhotoConnection,
} from "@/services/photo/photoService";
import { useAuth } from "@/services/auth/AuthProvider";
import { theme } from "@/theme/theme";

export default function SettingsScreen() {
  const { isConfigured, session, signOut, user } = useAuth();
  const [connectionMessage, setConnectionMessage] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const activePhotoSourceMode = getActivePhotoSourceMode();
  const nasBaseUrl = getNasPhotoApiBaseUrl();

  const items = [
    {
      title: "Supabase Status",
      value: isConfigured && session ? "Connected" : "Not connected",
    },
    {
      title: "Signed In Email",
      value: user?.email ?? "No active session",
    },
    {
      title: "Photo Source",
      value: activePhotoSourceMode === "nas" ? "NAS photos" : "Mock photos",
    },
    {
      title: "NAS API Base URL",
      value: nasBaseUrl || "Not configured",
    },
    {
      title: "NAS API Key",
      value: getNasPhotoApiKeyConfigured() ? "Configured" : "Missing",
    },
    { title: "Export Memories", value: "Coming soon" },
    { title: "Photo Awareness", value: "References only for now" },
    { title: "AI Cleanup", value: "Coming soon" },
  ];

  const handleTestPhotoConnection = async () => {
    const today = new Date().toISOString().slice(0, 10);
    setIsTestingConnection(true);
    setConnectionMessage("");

    try {
      const result = await testPhotoConnection(today);
      if (activePhotoSourceMode === "nas") {
        const details = [
          result.message,
          result.healthOk ? "API reachable: yes" : "API reachable: no",
          result.authValid ? "Auth valid: yes" : "Auth valid: no",
          typeof result.uptimeSeconds === "number"
            ? `Server uptime: ${result.uptimeSeconds} second(s)`
            : null,
          typeof result.schedulerEnabled === "boolean"
            ? `Scheduler enabled: ${result.schedulerEnabled ? "yes" : "no"}`
            : null,
          result.nextScheduledScanAt ? `Next scheduled scan: ${result.nextScheduledScanAt}` : null,
          typeof result.scanInProgress === "boolean"
            ? `Scan in progress: ${result.scanInProgress ? "yes" : "no"}`
            : null,
          typeof result.indexedPhotoCount === "number"
            ? `Indexed photo count: ${result.indexedPhotoCount}`
            : null,
          typeof result.missingPhotoCount === "number"
            ? `Missing photo count: ${result.missingPhotoCount}`
            : null,
          result.lastScanFinishedAt ? `Last scan finished: ${result.lastScanFinishedAt}` : null,
          result.lastScanStatus ? `Last scan status: ${result.lastScanStatus}` : null,
          typeof result.rootReachable === "boolean"
            ? `Photo root reachable: ${result.rootReachable ? "yes" : "no"}`
            : null,
        ]
          .filter(Boolean)
          .join("\n");

        setConnectionMessage(details);
      } else {
        setConnectionMessage(result.message);
      }
    } catch (error) {
      setConnectionMessage(
        activePhotoSourceMode === "nas"
          ? "Cannot reach Photo API."
          : `Photo provider test failed: ${error instanceof Error ? error.message : "unknown error"}`
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Tiny Chapters</Text>
        <Text style={styles.subtitle}>
          A quiet place for small family memories and daily moments.
        </Text>
      </View>

      <View style={styles.card}>
        {items.map((item) => (
          <View key={item.title} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowValue}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable style={styles.secondaryButton} onPress={() => void handleTestPhotoConnection()}>
        {isTestingConnection ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : (
          <Text style={styles.secondaryButtonText}>Test Photo Connection</Text>
        )}
      </Pressable>

      {connectionMessage ? <Text style={styles.connectionMessage}>{connectionMessage}</Text> : null}

      <Pressable style={styles.signOutButton} onPress={() => void signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
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
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  rowCopy: {
    gap: 4,
  },
  rowTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  rowValue: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
  },
  signOutButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing.md,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
  },
  secondaryButtonText: {
    color: theme.colors.accent,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  signOutText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  connectionMessage: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
});
