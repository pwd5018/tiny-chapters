import { type ReactNode, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import {
  clearDiagnosticsEvents,
  getDiagnosticsSnapshot,
  getIosReadinessDiagnostics,
  getNotificationDiagnostics,
  getPendingNasMatchDiagnostics,
  getPhotoDurabilityCounts,
  getRecentDiagnosticsEvents,
  isDeveloperModeEnabled,
  runNotificationTest,
  runRelinkRetry,
  testNasHealth,
  testNasStatus,
  testSupabaseConnection,
  type DiagnosticsEvent,
  type DiagnosticsSnapshot,
  type IosReadinessDiagnostics,
  type NasHealthResult,
  type NasStatusResult,
  type NotificationDiagnostics,
  type PendingNasMatchDiagnosticsResult,
  type SupabaseDiagnosticsResult,
} from "@/services/diagnostics/diagnosticsService";
import type { NasRelinkSummary, PhotoDurabilitySummary } from "@/services/photo/photoRelinkService";
import { theme } from "@/theme/theme";

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Unavailable";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatNextReminder(value: number | null) {
  if (typeof value !== "number") {
    return "No reminder scheduled";
  }

  return new Date(value).toLocaleString();
}

function formatCandidateValue(value: string | number | undefined) {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "Unavailable";
}

function DiagnosticsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function KeyValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function DiagnosticsScreen() {
  const router = useRouter();
  const [developerModeEnabled, setDeveloperModeEnabled] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [supabaseResult, setSupabaseResult] = useState<SupabaseDiagnosticsResult | null>(null);
  const [nasHealthResult, setNasHealthResult] = useState<NasHealthResult | null>(null);
  const [nasStatusResult, setNasStatusResult] = useState<NasStatusResult | null>(null);
  const [durabilitySummary, setDurabilitySummary] = useState<PhotoDurabilitySummary | null>(null);
  const [relinkSummary, setRelinkSummary] = useState<NasRelinkSummary | null>(null);
  const [pendingMatchDiagnostics, setPendingMatchDiagnostics] =
    useState<PendingNasMatchDiagnosticsResult | null>(null);
  const [notificationDiagnostics, setNotificationDiagnostics] = useState<NotificationDiagnostics | null>(null);
  const [iosReadinessDiagnostics, setIosReadinessDiagnostics] = useState<IosReadinessDiagnostics | null>(null);
  const [events, setEvents] = useState<DiagnosticsEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isTestingNasHealth, setIsTestingNasHealth] = useState(false);
  const [isTestingNasStatus, setIsTestingNasStatus] = useState(false);
  const [isRetryingRelink, setIsRetryingRelink] = useState(false);
  const [isInspectingPendingMatches, setIsInspectingPendingMatches] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [isClearingEvents, setIsClearingEvents] = useState(false);

  const loadDiagnostics = useCallback(async () => {
    setIsLoading(true);

    try {
      const enabled = await isDeveloperModeEnabled();
      setDeveloperModeEnabled(enabled);

      if (!enabled) {
        setSnapshot(null);
        setDurabilitySummary(null);
        setNotificationDiagnostics(null);
        setIosReadinessDiagnostics(null);
        setEvents([]);
        return;
      }

      const [
        nextSnapshot,
        nextDurability,
        nextNotificationDiagnostics,
        nextIosReadinessDiagnostics,
        nextEvents,
      ] =
        await Promise.all([
          getDiagnosticsSnapshot(),
          getPhotoDurabilityCounts(),
          getNotificationDiagnostics(),
          getIosReadinessDiagnostics(),
          getRecentDiagnosticsEvents(),
        ]);

      setSnapshot(nextSnapshot);
      setDurabilitySummary(nextDurability);
      setNotificationDiagnostics(nextNotificationDiagnostics);
      setIosReadinessDiagnostics(nextIosReadinessDiagnostics);
      setEvents(nextEvents);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDiagnostics();
    }, [loadDiagnostics])
  );

  const refreshEvents = async () => {
    setEvents(await getRecentDiagnosticsEvents());
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.stateText}>Loading diagnostics...</Text>
      </SafeAreaView>
    );
  }

  if (!developerModeEnabled) {
    return (
      <SafeAreaView style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.disabledTitle}>Developer Mode is disabled.</Text>
        <Text style={styles.disabledCopy}>
          Unlock it from Settings first if you want to inspect diagnostics.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace("/(tabs)/settings")}>
          <Text style={styles.primaryButtonText}>Back to Settings</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <Text style={styles.eyebrow}>Developer Mode</Text>
          <Text style={styles.title}>Diagnostics</Text>
          <Text style={styles.subtitle}>
            These checks are for development only. Secrets stay hidden, and this screen does not change your storage model.
          </Text>
        </View>

        <DiagnosticsSection title="App Environment">
          <KeyValue label="App version" value={snapshot?.app.version ?? "Unknown"} />
          <KeyValue label="Runtime environment" value={snapshot?.app.runtimeEnvironment ?? "Unknown"} />
          <KeyValue label="Photo source mode" value={snapshot?.app.photoSourceMode ?? "Unknown"} />
          <KeyValue label="NAS Photo API" value={snapshot?.app.nasPhotoApiBaseUrl ?? "Not configured"} />
          <KeyValue
            label="Photo API network path"
            value={snapshot?.app.nasPhotoApiNetworkTarget ?? "Not configured"}
          />
          <KeyValue label="Supabase URL" value={snapshot?.app.supabaseUrl ?? "Not configured"} />
          <KeyValue label="Platform" value={snapshot?.app.platform ?? "Unknown"} />
          <KeyValue label="Expo ownership" value={snapshot?.app.expoOwnership ?? "Unknown"} />
          <KeyValue label="Development runtime" value={snapshot?.app.isDev ? "Yes" : "No"} />
        </DiagnosticsSection>

        <DiagnosticsSection title="Supabase">
          <KeyValue label="Configured" value={snapshot?.supabase.configured ? "Yes" : "No"} />
          <KeyValue label="Authenticated" value={snapshot?.supabase.authenticated ? "Yes" : "No"} />
          <KeyValue label="Signed-in email" value={snapshot?.supabase.email ?? "Unknown"} />
          <KeyValue label="User id" value={snapshot?.supabase.maskedUserId ?? "Unavailable"} />
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              void (async () => {
                setIsTestingSupabase(true);
                try {
                  setSupabaseResult(await testSupabaseConnection());
                } finally {
                  setIsTestingSupabase(false);
                  await refreshEvents();
                }
              })();
            }}
          >
            {isTestingSupabase ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : (
              <Text style={styles.secondaryButtonText}>Test Supabase Connection</Text>
            )}
          </Pressable>
          {supabaseResult ? (
            <Text style={styles.detailText}>
              {supabaseResult.message}
            </Text>
          ) : null}
        </DiagnosticsSection>

        <DiagnosticsSection title="NAS Photo API">
          <KeyValue label="Active source mode" value={snapshot?.app.photoSourceMode ?? "Unknown"} />
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              void (async () => {
                setIsTestingNasHealth(true);
                try {
                  setNasHealthResult(await testNasHealth());
                } finally {
                  setIsTestingNasHealth(false);
                  await refreshEvents();
                }
              })();
            }}
          >
            {isTestingNasHealth ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : (
              <Text style={styles.secondaryButtonText}>Test NAS /health</Text>
            )}
          </Pressable>
          {nasHealthResult ? (
            <Text style={styles.detailText}>{nasHealthResult.message}</Text>
          ) : null}
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              void (async () => {
                setIsTestingNasStatus(true);
                try {
                  setNasStatusResult(await testNasStatus());
                } finally {
                  setIsTestingNasStatus(false);
                  await refreshEvents();
                }
              })();
            }}
          >
            {isTestingNasStatus ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : (
              <Text style={styles.secondaryButtonText}>Test NAS /status</Text>
            )}
          </Pressable>
          {nasStatusResult ? (
            <View style={styles.group}>
              <Text style={styles.detailText}>{nasStatusResult.message}</Text>
              <KeyValue label="API reachable" value={nasStatusResult.ok ? "Yes" : "No"} />
              <KeyValue label="Auth valid" value={nasStatusResult.authValid ? "Yes" : "No"} />
              <KeyValue label="Indexed photo count" value={String(nasStatusResult.indexedPhotoCount ?? 0)} />
              <KeyValue label="Missing photo count" value={String(nasStatusResult.missingPhotoCount ?? 0)} />
              <KeyValue label="Root reachable" value={nasStatusResult.rootReachable ? "Yes" : "No"} />
              <KeyValue label="Scheduler enabled" value={nasStatusResult.schedulerEnabled ? "Yes" : "No"} />
              <KeyValue label="Next scheduled scan" value={formatDateTime(nasStatusResult.nextScheduledScanAt)} />
              <KeyValue label="Scan in progress" value={nasStatusResult.scanInProgress ? "Yes" : "No"} />
              <KeyValue label="Last scan status" value={nasStatusResult.lastScanStatus ?? "Unavailable"} />
              <KeyValue label="Last scan finished" value={formatDateTime(nasStatusResult.lastScanFinishedAt)} />
            </View>
          ) : null}
        </DiagnosticsSection>

        <DiagnosticsSection title="Photo Relink">
          <KeyValue label="Pending NAS matches" value={String(durabilitySummary?.pendingNasMatches ?? 0)} />
          <KeyValue label="Linked NAS photos" value={String(durabilitySummary?.linkedNasPhotos ?? 0)} />
          <KeyValue label="Missing photos" value={String(durabilitySummary?.missingPhotos ?? 0)} />
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              void (async () => {
                setIsRetryingRelink(true);
                try {
                  const result = await runRelinkRetry();
                  setRelinkSummary(result);
                  setDurabilitySummary(await getPhotoDurabilityCounts());
                } finally {
                  setIsRetryingRelink(false);
                  await refreshEvents();
                }
              })();
            }}
          >
            {isRetryingRelink ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : (
              <Text style={styles.secondaryButtonText}>Retry NAS Photo Matching</Text>
            )}
          </Pressable>
          {relinkSummary ? (
            <View style={styles.group}>
              <KeyValue label="Checked" value={String(relinkSummary.checked)} />
              <KeyValue label="Matched" value={String(relinkSummary.matched)} />
              <KeyValue label="Still pending" value={String(relinkSummary.stillPending)} />
              <KeyValue label="Errors" value={String(relinkSummary.errors)} />
            </View>
          ) : null}
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              void (async () => {
                setIsInspectingPendingMatches(true);
                try {
                  setPendingMatchDiagnostics(await getPendingNasMatchDiagnostics());
                } finally {
                  setIsInspectingPendingMatches(false);
                  await refreshEvents();
                }
              })();
            }}
          >
            {isInspectingPendingMatches ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : (
              <Text style={styles.secondaryButtonText}>Inspect Pending Matches</Text>
            )}
          </Pressable>
          {pendingMatchDiagnostics ? (
            <View style={styles.group}>
              <Text style={styles.detailText}>
                Inspected {pendingMatchDiagnostics.inspected} pending photo reference
                {pendingMatchDiagnostics.inspected === 1 ? "" : "s"}.
              </Text>
              {pendingMatchDiagnostics.items.length ? (
                pendingMatchDiagnostics.items.map((item, index) => (
                  <View key={`${item.memoryId}-${item.ref.photoId}-${index}`} style={styles.logCard}>
                    <Text style={styles.logTitle}>
                      {item.ref.filename?.trim() || item.ref.photoId}
                    </Text>
                    <Text style={styles.logMeta}>
                      Memory {item.memoryId.slice(0, 8)} | {item.matchResult.status.toUpperCase()}
                    </Text>
                    <Text style={styles.logDetail}>{item.matchResult.message}</Text>
                    <KeyValue
                      label="Taken at"
                      value={formatCandidateValue(item.candidate.takenAt)}
                    />
                    <KeyValue
                      label="File size"
                      value={formatCandidateValue(item.candidate.fileSize)}
                    />
                    <KeyValue
                      label="Dimensions"
                      value={`${formatCandidateValue(item.candidate.width)} x ${formatCandidateValue(item.candidate.height)}`}
                    />
                    <KeyValue label="Stored path" value={item.ref.path} />
                    {item.matchResult.matchedPhoto ? (
                      <View style={styles.group}>
                        <KeyValue
                          label="Matched filename"
                          value={item.matchResult.matchedPhoto.filename}
                        />
                        <KeyValue
                          label="Matched path"
                          value={item.matchResult.matchedPhoto.path}
                        />
                        <KeyValue
                          label="Confidence"
                          value={formatCandidateValue(item.matchResult.confidence)}
                        />
                      </View>
                    ) : null}
                    {item.matchResult.candidates?.length ? (
                      <View style={styles.group}>
                        {item.matchResult.candidates.map((candidate, candidateIndex) => (
                          <View
                            key={`${candidate.photo.id}-${candidateIndex}`}
                            style={styles.candidateCard}
                          >
                            <Text style={styles.logTitle}>
                              Candidate {candidateIndex + 1}: {candidate.photo.filename}
                            </Text>
                            <Text style={styles.logMeta}>
                              Confidence {candidate.confidence}
                            </Text>
                            <Text style={styles.logDetail}>{candidate.photo.path}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.detailText}>
                  No pending photo references were available to inspect.
                </Text>
              )}
            </View>
          ) : null}
        </DiagnosticsSection>

        <DiagnosticsSection title="Notifications">
          <KeyValue label="Permission status" value={notificationDiagnostics?.permissionStatus ?? "Unknown"} />
          <KeyValue label="Supported here" value={notificationDiagnostics?.supported ? "Yes" : "No"} />
          <KeyValue label="Reminders enabled" value={notificationDiagnostics?.remindersEnabled ? "Yes" : "No"} />
          <KeyValue label="Cadence" value={notificationDiagnostics?.cadence ?? "Unknown"} />
          <KeyValue label="Time" value={notificationDiagnostics?.time ?? "Unknown"} />
          <KeyValue label="Prompt style" value={notificationDiagnostics?.promptStyle ?? "Unknown"} />
          <KeyValue label="Scheduled notification count" value={String(notificationDiagnostics?.scheduledNotificationCount ?? 0)} />
          <KeyValue label="Next reminder" value={formatNextReminder(notificationDiagnostics?.nextReminderTimestamp ?? null)} />
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              void (async () => {
                setIsTestingNotification(true);
                try {
                  await runNotificationTest();
                  setNotificationDiagnostics(await getNotificationDiagnostics());
                } finally {
                  setIsTestingNotification(false);
                  await refreshEvents();
                }
              })();
            }}
          >
            {isTestingNotification ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : (
              <Text style={styles.secondaryButtonText}>Test Notification</Text>
            )}
          </Pressable>
        </DiagnosticsSection>

        <DiagnosticsSection title="iOS Readiness">
          <KeyValue label="Current platform" value={iosReadinessDiagnostics?.platform ?? "Unknown"} />
          <KeyValue label="Bundle identifier" value={iosReadinessDiagnostics?.bundleIdentifier ?? "Unavailable"} />
          <KeyValue label="Notification permission" value={iosReadinessDiagnostics?.notificationPermissionStatus ?? "Unknown"} />
          <KeyValue label="Camera permission" value={iosReadinessDiagnostics?.cameraPermissionStatus ?? "Unknown"} />
          <KeyValue label="Media permission" value={iosReadinessDiagnostics?.mediaLibraryPermissionStatus ?? "Unknown"} />
          <KeyValue label="Photo source mode" value={iosReadinessDiagnostics?.photoSourceMode ?? "Unknown"} />
          <KeyValue label="Photo API URL" value={iosReadinessDiagnostics?.photoApiUrl ?? "Not configured"} />
          <KeyValue
            label="Photo API network path"
            value={iosReadinessDiagnostics?.photoApiNetworkTarget ?? "Not configured"}
          />
          {iosReadinessDiagnostics?.remoteAccessGuidance ? (
            <Text style={styles.detailText}>{iosReadinessDiagnostics.remoteAccessGuidance}</Text>
          ) : null}
          {iosReadinessDiagnostics?.localUriRiskNote ? (
            <Text style={styles.detailText}>{iosReadinessDiagnostics.localUriRiskNote}</Text>
          ) : null}
          {iosReadinessDiagnostics?.localhostWarning ? (
            <Text style={styles.warningText}>{iosReadinessDiagnostics.localhostWarning}</Text>
          ) : null}
          {iosReadinessDiagnostics?.lanWarning ? (
            <Text style={styles.warningText}>{iosReadinessDiagnostics.lanWarning}</Text>
          ) : null}
          {iosReadinessDiagnostics?.customUrlWarning ? (
            <Text style={styles.warningText}>{iosReadinessDiagnostics.customUrlWarning}</Text>
          ) : null}
          {iosReadinessDiagnostics?.insecureHttpWarning ? (
            <Text style={styles.warningText}>{iosReadinessDiagnostics.insecureHttpWarning}</Text>
          ) : null}
        </DiagnosticsSection>

        <DiagnosticsSection title="Recent Diagnostics Log">
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              void (async () => {
                setIsClearingEvents(true);
                try {
                  await clearDiagnosticsEvents();
                  await refreshEvents();
                } finally {
                  setIsClearingEvents(false);
                }
              })();
            }}
          >
            {isClearingEvents ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : (
              <Text style={styles.secondaryButtonText}>Clear Diagnostics Events</Text>
            )}
          </Pressable>

          {events.length ? (
            <View style={styles.logList}>
              {events.map((event) => (
                <View key={event.id} style={styles.logCard}>
                  <Text style={styles.logTitle}>
                    [{event.category}] {event.title}
                  </Text>
                  <Text style={styles.logMeta}>
                    {event.level.toUpperCase()} | {formatDateTime(event.timestamp)}
                  </Text>
                  {event.detail ? <Text style={styles.logDetail}>{event.detail}</Text> : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.detailText}>No diagnostics events recorded yet.</Text>
          )}
        </DiagnosticsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  centered: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.md,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  content: {
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  header: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
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
    lineHeight: 22,
  },
  disabledTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
    textAlign: "center",
  },
  disabledCopy: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
    textAlign: "center",
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  row: {
    gap: 4,
  },
  rowLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  rowValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
  },
  detailText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  warningText: {
    color: "#B44D47",
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  group: {
    gap: theme.spacing.sm,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
  },
  primaryButtonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
  },
  secondaryButtonText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  logList: {
    gap: theme.spacing.sm,
  },
  logCard: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: 2,
    padding: theme.spacing.md,
  },
  candidateCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: 2,
    padding: theme.spacing.sm,
  },
  logTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  logMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  logDetail: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  stateText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
  },
});
