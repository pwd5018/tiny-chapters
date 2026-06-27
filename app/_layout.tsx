import { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AuthScreen } from "@/components/AuthScreen";
import { AuthProvider, useAuth } from "@/services/auth/AuthProvider";
import { MemoryProvider } from "@/services/memoryService";
import {
  addReminderResponseListener,
  configureReminderNotifications,
  isReminderNotificationsSupported,
  rescheduleMemoryReminders,
} from "@/services/notifications/reminderService";
import { PhotoAttachmentProvider } from "@/services/photo/photoAttachmentContext";
import { runStartupDiagnosticsIfDeveloperMode } from "@/services/diagnostics/diagnosticsService";
import { attemptNasRelinkForAllMemories } from "@/services/photo/photoRelinkService";
import { getActivePhotoSourceMode } from "@/services/photo/photoService";
import { theme } from "@/theme/theme";

export default function RootLayout() {
  return (
    <AuthProvider>
      <PhotoAttachmentProvider>
        <MemoryProvider>
          <RootNavigator />
        </MemoryProvider>
      </PhotoAttachmentProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const router = useRouter();
  const { isConfigured, isLoading, user } = useAuth();
  const hasStartedRelinkRef = useRef(false);
  const hasRunStartupDiagnosticsRef = useRef(false);

  useEffect(() => {
    void configureReminderNotifications();
  }, []);

  useEffect(() => {
    if (isLoading || !isConfigured || !user || hasRunStartupDiagnosticsRef.current) {
      return;
    }

    hasRunStartupDiagnosticsRef.current = true;

    void runStartupDiagnosticsIfDeveloperMode();
  }, [isConfigured, isLoading, user]);

  useEffect(() => {
    if (isLoading || !isConfigured || !user || hasStartedRelinkRef.current) {
      return;
    }

    if (getActivePhotoSourceMode() !== "nas") {
      return;
    }

    hasStartedRelinkRef.current = true;

    void attemptNasRelinkForAllMemories()
      .then((summary) => {
        if (__DEV__) {
          console.log("[tiny-chapters] Startup NAS relink summary", summary);
        }
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn("[tiny-chapters] Startup NAS relink failed", error);
        }
      });
  }, [isConfigured, isLoading, user]);

  useEffect(() => {
    if (isLoading || !isConfigured || !user) {
      return;
    }

    void rescheduleMemoryReminders().catch((error) => {
      if (__DEV__) {
        console.warn("[tiny-chapters] Reminder reschedule failed", error);
      }
    });
  }, [isConfigured, isLoading, user]);

  useEffect(() => {
    if (!isReminderNotificationsSupported()) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    void addReminderResponseListener((data) => {
      if (data?.kind === "memory_reminder") {
        router.replace("/(tabs)" as never);
      }
    }).then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      unsubscribe?.();
    };
  }, [router]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.loadingText}>Loading your Tiny Chapters session...</Text>
      </View>
    );
  }

  if (!isConfigured || !user) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.md,
    justifyContent: "center",
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
  },
});
