import { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";

import { AuthScreen } from "@/components/AuthScreen";
import { AuthProvider, useAuth } from "@/services/auth/AuthProvider";
import { MemoryProvider } from "@/services/memoryService";
import {
  configureReminderNotifications,
  rescheduleMemoryReminders,
} from "@/services/notifications/reminderService";
import { PhotoAttachmentProvider } from "@/services/photo/photoAttachmentContext";
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
  const handledNotificationResponseIdRef = useRef<string | null>(null);
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    void configureReminderNotifications();
  }, []);

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
    if (!lastNotificationResponse) {
      return;
    }

    const requestId = lastNotificationResponse.notification.request.identifier;
    if (handledNotificationResponseIdRef.current === requestId) {
      return;
    }

    handledNotificationResponseIdRef.current = requestId;

    const data = lastNotificationResponse.notification.request.content.data as
      | { kind?: string; route?: string }
      | undefined;

    if (data?.kind === "memory_reminder") {
      router.replace("/(tabs)" as never);
    }
  }, [lastNotificationResponse, router]);

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
