import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/services/auth/AuthProvider";
import { theme } from "@/theme/theme";

export function AuthScreen() {
  const { isConfigured, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!isConfigured) {
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      if (mode === "sign-in") {
        await signIn(email.trim(), password);
      } else {
        const user = await signUp(email.trim(), password);
        if (user) {
          setStatusMessage("Account created. If email confirmation is enabled, check your inbox.");
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Tiny Chapters</Text>
        <Text style={styles.title}>A private place for the little moments.</Text>
        <Text style={styles.subtitle}>
          Sign in to keep your chapters in Supabase while your photos stay as references.
        </Text>

        {!isConfigured ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Supabase isn't configured yet.</Text>
            <Text style={styles.noticeText}>
              Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to your Expo env.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggle, mode === "sign-in" && styles.toggleActive]}
                onPress={() => setMode("sign-in")}
              >
                <Text style={[styles.toggleText, mode === "sign-in" && styles.toggleTextActive]}>
                  Sign In
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggle, mode === "sign-up" && styles.toggleActive]}
                onPress={() => setMode("sign-up")}
              >
                <Text style={[styles.toggleText, mode === "sign-up" && styles.toggleTextActive]}>
                  Sign Up
                </Text>
              </Pressable>
            </View>

            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor={theme.colors.textSoft}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={theme.colors.textSoft}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />

            <Pressable style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color={theme.colors.buttonText} />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === "sign-in" ? "Sign In" : "Create Account"}
                </Text>
              )}
            </Pressable>

            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    maxWidth: 420,
    padding: theme.spacing.xl,
    width: "100%",
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
  },
  toggleRow: {
    backgroundColor: theme.colors.input,
    borderRadius: theme.radii.pill,
    flexDirection: "row",
    padding: 4,
  },
  toggle: {
    alignItems: "center",
    borderRadius: theme.radii.pill,
    flex: 1,
    paddingVertical: theme.spacing.sm,
  },
  toggleActive: {
    backgroundColor: theme.colors.accent,
  },
  toggleText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    fontWeight: "600",
  },
  toggleTextActive: {
    color: theme.colors.buttonText,
  },
  input: {
    backgroundColor: theme.colors.input,
    borderRadius: theme.radii.md,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
  },
  buttonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  error: {
    color: "#B44D47",
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  status: {
    color: theme.colors.success,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  notice: {
    backgroundColor: theme.colors.input,
    borderRadius: theme.radii.md,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  noticeTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  noticeText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
});
