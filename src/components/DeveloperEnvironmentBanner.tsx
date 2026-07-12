import { useCallback, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import {
  getAppEnvironmentLabel,
  getAppRuntimeLabel,
  getMetroDevServerNetworkTargetLabel,
  getMetroDevServerUrl,
  getNasPhotoApiNetworkTargetLabel,
  nasPhotoApiBaseUrl,
  supabaseUrl,
} from "@/config/appConfig";
import { isDeveloperModeEnabled } from "@/services/diagnostics/diagnosticsService";
import { getActivePhotoSourceMode } from "@/services/photo/photoService";
import { theme } from "@/theme/theme";

export function DeveloperEnvironmentBanner() {
  const [developerModeEnabled, setDeveloperModeEnabled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void isDeveloperModeEnabled().then((enabled) => {
        if (isActive) {
          setDeveloperModeEnabled(enabled);
        }
      });

      return () => {
        isActive = false;
      };
    }, [])
  );

  if (!developerModeEnabled) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Developer environment</Text>
      <Text style={styles.detail}>Environment: {getAppEnvironmentLabel()}</Text>
      <Text style={styles.detail}>
        Runtime: {getAppRuntimeLabel()} on {Platform.OS}
      </Text>
      <Text style={styles.detail}>Photo source: {getActivePhotoSourceMode()}</Text>
      <Text style={styles.detail}>Metro: {getMetroDevServerUrl() || "Unavailable"}</Text>
      <Text style={styles.detail}>Metro path: {getMetroDevServerNetworkTargetLabel()}</Text>
      <Text style={styles.detail}>Photo API: {nasPhotoApiBaseUrl || "Not configured"}</Text>
      <Text style={styles.detail}>Photo API path: {getNasPhotoApiNetworkTargetLabel()}</Text>
      <Text style={styles.detail}>Supabase: {supabaseUrl || "Not configured"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FFF4E2",
    borderBottomColor: "#E8D8C1",
    borderBottomWidth: 1,
    gap: 2,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detail: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
});
