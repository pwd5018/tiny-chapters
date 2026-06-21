import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AuthScreen } from "@/components/AuthScreen";
import { AuthProvider, useAuth } from "@/services/auth/AuthProvider";
import { MemoryProvider } from "@/services/memoryService";
import { theme } from "@/theme/theme";

export default function RootLayout() {
  return (
    <AuthProvider>
      <MemoryProvider>
        <RootNavigator />
      </MemoryProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { isConfigured, isLoading, user } = useAuth();

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
