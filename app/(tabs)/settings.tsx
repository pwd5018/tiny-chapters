import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { TimePickerField } from "@/components/TimePickerField";
import {
  getReminderDescription,
  getReminderSettings,
  getNextReminderDate,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  rescheduleMemoryReminders,
  saveReminderSettings,
  sendTestMemoryReminder,
} from "@/services/notifications/reminderService";
import {
  getActivePhotoSourceMode,
  getNasPhotoApiBaseUrl,
  getNasPhotoApiKeyConfigured,
  testPhotoConnection,
} from "@/services/photo/photoService";
import {
  attemptNasRelinkForAllMemories,
  getPhotoDurabilitySummary,
  type PhotoDurabilitySummary,
} from "@/services/photo/photoRelinkService";
import { useAuth } from "@/services/auth/AuthProvider";
import { theme } from "@/theme/theme";
import type {
  ReminderCadence,
  ReminderPermissionStatus,
  ReminderPromptStyle,
  ReminderSettings,
} from "@/types/reminder";

const CADENCE_OPTIONS: Array<{ label: string; value: ReminderCadence }> = [
  { label: "Daily", value: "daily" },
  { label: "Weekdays", value: "weekdays" },
  { label: "Weekly", value: "weekly" },
];

const PROMPT_STYLE_OPTIONS: Array<{ label: string; value: ReminderPromptStyle }> = [
  { label: "Simple", value: "simple" },
  { label: "Family", value: "family" },
  { label: "Reflection", value: "reflection" },
];

const WEEKDAY_OPTIONS = [
  { label: "Sun", value: 1 },
  { label: "Mon", value: 2 },
  { label: "Tue", value: 3 },
  { label: "Wed", value: 4 },
  { label: "Thu", value: 5 },
  { label: "Fri", value: 6 },
  { label: "Sat", value: 7 },
];

function formatPermissionStatus(status: ReminderPermissionStatus) {
  switch (status) {
    case "granted":
      return "Granted";
    case "denied":
      return "Denied";
    default:
      return "Not requested";
  }
}

function formatNextReminder(timestamp: number | null) {
  if (typeof timestamp !== "number") {
    return "No reminder scheduled yet.";
  }

  return new Date(timestamp).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SettingsScreen() {
  const { isConfigured, session, signOut, user } = useAuth();
  const [connectionMessage, setConnectionMessage] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [durabilitySummary, setDurabilitySummary] = useState<PhotoDurabilitySummary | null>(null);
  const [isLoadingDurability, setIsLoadingDurability] = useState(true);
  const [relinkMessage, setRelinkMessage] = useState("");
  const [isRetryingRelink, setIsRetryingRelink] = useState(false);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<ReminderPermissionStatus>("undetermined");
  const [nextReminderTimestamp, setNextReminderTimestamp] = useState<number | null>(null);
  const [reminderMessage, setReminderMessage] = useState("");
  const [isLoadingReminderSettings, setIsLoadingReminderSettings] = useState(true);
  const [isSavingReminderSettings, setIsSavingReminderSettings] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSendingTestNotification, setIsSendingTestNotification] = useState(false);

  const activePhotoSourceMode = getActivePhotoSourceMode();
  const nasBaseUrl = getNasPhotoApiBaseUrl();

  const loadDurabilitySummary = useCallback(async () => {
    setIsLoadingDurability(true);

    try {
      const nextSummary = await getPhotoDurabilitySummary();
      setDurabilitySummary(nextSummary);
    } catch {
      setDurabilitySummary(null);
    } finally {
      setIsLoadingDurability(false);
    }
  }, []);

  const loadReminderState = useCallback(async () => {
    setIsLoadingReminderSettings(true);

    try {
      const [settings, status] = await Promise.all([
        getReminderSettings(),
        getNotificationPermissionStatus(),
      ]);
      const nextReminder = await getNextReminderDate(settings);

      setReminderSettings(settings);
      setPermissionStatus(status);
      setNextReminderTimestamp(nextReminder);
    } catch {
      setReminderSettings(null);
      setPermissionStatus("undetermined");
      setNextReminderTimestamp(null);
    } finally {
      setIsLoadingReminderSettings(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([loadDurabilitySummary(), loadReminderState()]);
    }, [loadDurabilitySummary, loadReminderState])
  );

  const handleRetryNasPhotoMatching = async () => {
    setIsRetryingRelink(true);
    setRelinkMessage("");

    try {
      const summary = await attemptNasRelinkForAllMemories();
      await loadDurabilitySummary();
      setRelinkMessage(
        `Matched: ${summary.matched}. Still pending: ${summary.stillPending}. Errors: ${summary.errors}.`
      );
    } catch (error) {
      setRelinkMessage(
        error instanceof Error ? error.message : "Could not retry NAS photo matching."
      );
    } finally {
      setIsRetryingRelink(false);
    }
  };

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

  const handlePermissionRequest = async () => {
    setIsRequestingPermission(true);
    setReminderMessage("");

    try {
      const status = await requestNotificationPermission();
      setPermissionStatus(status);
      if (status === "granted") {
        setReminderMessage("Notifications are enabled for Tiny Chapters.");
      } else {
        setReminderMessage(
          "Notifications are still unavailable. If the system keeps denying them, enable Tiny Chapters notifications in Android settings."
        );
      }
    } catch (error) {
      setReminderMessage(
        error instanceof Error ? error.message : "Could not request notification permission."
      );
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleReminderSave = async () => {
    if (!reminderSettings) {
      return;
    }

    setIsSavingReminderSettings(true);
    setReminderMessage("");

    try {
      let nextPermissionStatus = permissionStatus;

      if (reminderSettings.enabled && permissionStatus !== "granted") {
        nextPermissionStatus = await requestNotificationPermission();
        setPermissionStatus(nextPermissionStatus);
      }

      const settingsToSave: ReminderSettings = {
        ...reminderSettings,
        daysOfWeek:
          reminderSettings.cadence === "weekly"
            ? reminderSettings.daysOfWeek?.length
              ? [reminderSettings.daysOfWeek[0]]
              : [1]
            : reminderSettings.cadence === "weekdays"
              ? [2, 3, 4, 5, 6]
              : undefined,
      };

      await saveReminderSettings(settingsToSave);
      setReminderSettings(settingsToSave);

      if (settingsToSave.enabled && nextPermissionStatus !== "granted") {
        setReminderMessage(
          "Reminder settings were saved, but Android notifications are not enabled yet. You may need to allow them in system settings."
        );
        setNextReminderTimestamp(null);
        return;
      }

      await rescheduleMemoryReminders();
      const nextReminder = await getNextReminderDate(settingsToSave);
      setNextReminderTimestamp(nextReminder);
      setReminderMessage(
        settingsToSave.enabled
          ? "Memory reminders updated."
          : "Memory reminders are turned off."
      );
    } catch (error) {
      setReminderMessage(
        error instanceof Error ? error.message : "Could not save reminder settings."
      );
    } finally {
      setIsSavingReminderSettings(false);
    }
  };

  const handleTestNotification = async () => {
    if (!reminderSettings) {
      return;
    }

    setIsSendingTestNotification(true);
    setReminderMessage("");

    try {
      const status = await getNotificationPermissionStatus();
      setPermissionStatus(status);

      if (status !== "granted") {
        setReminderMessage(
          "Notifications are not enabled yet. Allow them first, then try the test reminder again."
        );
        return;
      }

      await sendTestMemoryReminder(reminderSettings.promptStyle);
      setReminderMessage("Test reminder scheduled for about 5 seconds from now.");
    } catch (error) {
      setReminderMessage(
        error instanceof Error ? error.message : "Could not send a test reminder."
      );
    } finally {
      setIsSendingTestNotification(false);
    }
  };

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

      <View style={styles.durabilityCard}>
        <Text style={styles.durabilityTitle}>Photo durability</Text>
        <Text style={styles.durabilityCopy}>
          NAS-linked photos are durable. Local phone photos stay temporary until the phone backup lands on your NAS and the Photo API scan can match them.
        </Text>
        <Text style={styles.durabilityCopy}>
          Pending NAS match means Tiny Chapters is waiting for backup, a Photo API scan, and a relink pass that can promote the reference into a durable NAS link.
        </Text>
        {isLoadingDurability ? (
          <View style={styles.inlineLoadingRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.durabilityStat}>Loading durability summary...</Text>
          </View>
        ) : durabilitySummary ? (
          <View style={styles.durabilityStats}>
            <Text style={styles.durabilityStat}>
              Pending NAS matches: {durabilitySummary.pendingNasMatches}
            </Text>
            <Text style={styles.durabilityStat}>
              Linked NAS photos: {durabilitySummary.linkedNasPhotos}
            </Text>
            <Text style={styles.durabilityStat}>
              Missing photos: {durabilitySummary.missingPhotos}
            </Text>
          </View>
        ) : null}
        <Pressable
          style={styles.secondaryButton}
          onPress={() => void handleRetryNasPhotoMatching()}
          disabled={isRetryingRelink}
        >
          {isRetryingRelink ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <Text style={styles.secondaryButtonText}>Retry NAS Photo Matching</Text>
          )}
        </Pressable>
        {relinkMessage ? <Text style={styles.connectionMessage}>{relinkMessage}</Text> : null}
      </View>

      <View style={styles.reminderCard}>
        <Text style={styles.reminderTitle}>Memory reminders</Text>
        <Text style={styles.reminderCopy}>
          Configure local reminder nudges on this device only. Tiny Chapters keeps these settings in local storage for now, not Supabase.
        </Text>

        {isLoadingReminderSettings || !reminderSettings ? (
          <View style={styles.inlineLoadingRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.reminderMeta}>Loading reminder settings...</Text>
          </View>
        ) : (
          <>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.rowTitle}>Enable reminders</Text>
                <Text style={styles.rowValue}>
                  Turn local memory reminders on or off for this device.
                </Text>
              </View>
              <Switch
                value={reminderSettings.enabled}
                onValueChange={(value) =>
                  setReminderSettings((current) =>
                    current
                      ? {
                          ...current,
                          enabled: value,
                        }
                      : current
                  )
                }
                trackColor={{ false: theme.colors.border, true: "#D6A78D" }}
                thumbColor={reminderSettings.enabled ? theme.colors.accent : "#FFFFFF"}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Cadence</Text>
              <View style={styles.chipRow}>
                {CADENCE_OPTIONS.map((option) => {
                  const isActive = reminderSettings.cadence === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() =>
                        setReminderSettings((current) =>
                          current
                            ? {
                                ...current,
                                cadence: option.value,
                                daysOfWeek:
                                  option.value === "weekly"
                                    ? current.daysOfWeek?.length
                                      ? [current.daysOfWeek[0]]
                                      : [1]
                                    : option.value === "weekdays"
                                      ? [2, 3, 4, 5, 6]
                                      : undefined,
                              }
                            : current
                        )
                      }
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {reminderSettings.cadence === "weekly" ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Weekly day</Text>
                <View style={styles.chipRow}>
                  {WEEKDAY_OPTIONS.map((option) => {
                    const isActive = reminderSettings.daysOfWeek?.[0] === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.dayChip, isActive && styles.chipActive]}
                        onPress={() =>
                          setReminderSettings((current) =>
                            current
                              ? {
                                  ...current,
                                  daysOfWeek: [option.value],
                                }
                              : current
                          )
                        }
                      >
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Time</Text>
              <TimePickerField
                value={reminderSettings.time}
                onChange={(time) =>
                  setReminderSettings((current) =>
                    current
                      ? {
                          ...current,
                          time,
                        }
                      : current
                  )
                }
                helperText="Choose when Tiny Chapters should remind you."
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Prompt style</Text>
              <View style={styles.chipRow}>
                {PROMPT_STYLE_OPTIONS.map((option) => {
                  const isActive = reminderSettings.promptStyle === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() =>
                        setReminderSettings((current) =>
                          current
                            ? {
                                ...current,
                                promptStyle: option.value,
                              }
                            : current
                        )
                      }
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Permission status</Text>
              <Text style={styles.summaryValue}>{formatPermissionStatus(permissionStatus)}</Text>
              <Text style={styles.summaryTitle}>Next reminder</Text>
              <Text style={styles.summaryValue}>{formatNextReminder(nextReminderTimestamp)}</Text>
              {reminderSettings.enabled ? (
                <Text style={styles.summaryHint}>{getReminderDescription(reminderSettings)}</Text>
              ) : (
                <Text style={styles.summaryHint}>Reminders are currently turned off.</Text>
              )}
              {permissionStatus === "denied" ? (
                <Text style={styles.permissionWarning}>
                  Android notifications are denied right now. You can retry below, but you may also need to enable them in system settings.
                </Text>
              ) : null}
            </View>

            <View style={styles.buttonStack}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => void handlePermissionRequest()}
                disabled={isRequestingPermission}
              >
                {isRequestingPermission ? (
                  <ActivityIndicator color={theme.colors.accent} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Allow Notifications</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.primaryButton}
                onPress={() => void handleReminderSave()}
                disabled={isSavingReminderSettings}
              >
                {isSavingReminderSettings ? (
                  <ActivityIndicator color={theme.colors.buttonText} />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Reminder Settings</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                onPress={() => void handleTestNotification()}
                disabled={isSendingTestNotification}
              >
                {isSendingTestNotification ? (
                  <ActivityIndicator color={theme.colors.accent} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Test Notification</Text>
                )}
              </Pressable>
            </View>
          </>
        )}

        {reminderMessage ? <Text style={styles.connectionMessage}>{reminderMessage}</Text> : null}
      </View>

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
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  secondaryButtonText: {
    color: theme.colors.accent,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  primaryButtonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  signOutButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing.md,
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
  durabilityCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  durabilityTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  durabilityCopy: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  durabilityStats: {
    gap: theme.spacing.xs,
  },
  durabilityStat: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  inlineLoadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  reminderCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  reminderTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  reminderCopy: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  reminderMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  fieldGroup: {
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  chip: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  dayChip: {
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    minWidth: 48,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  chipText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  chipTextActive: {
    color: theme.colors.buttonText,
  },
  summaryCard: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  summaryTitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
  },
  summaryHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  permissionWarning: {
    color: "#B44D47",
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  buttonStack: {
    gap: theme.spacing.sm,
  },
});
