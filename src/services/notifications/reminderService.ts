import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type {
  NotificationPermissionsStatus,
  NotificationTriggerInput,
  SchedulableNotificationTriggerInput,
  SchedulableTriggerInputTypes,
} from "expo-notifications";

import type {
  ReminderCadence,
  ReminderPermissionStatus,
  ReminderPromptStyle,
  ReminderSettings,
} from "@/types/reminder";
import { isExpoGoRuntime } from "@/config/appConfig";

const REMINDER_SETTINGS_KEY = "tiny_chapters.reminder_settings";
const REMINDER_IDS_KEY = "tiny_chapters.reminder_notification_ids";
const REMINDER_CHANNEL_ID = "memory-reminders";
const WEEKDAY_VALUES = [2, 3, 4, 5, 6];

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  cadence: "daily",
  time: "20:00",
  promptStyle: "simple",
  lastUpdatedAt: new Date(0).toISOString(),
};

type ReminderMessage = {
  title: string;
  body: string;
};

type ExpoNotificationsModule = typeof import("expo-notifications");

let notificationsModulePromise: Promise<ExpoNotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

export function isReminderNotificationsSupported() {
  return !isExpoGoRuntime();
}

async function getNotificationsModule(): Promise<ExpoNotificationsModule | null> {
  if (!isReminderNotificationsSupported()) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications")
      .then(async (Notifications) => {
        if (!notificationHandlerConfigured) {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldPlaySound: false,
              shouldSetBadge: false,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });
          notificationHandlerConfigured = true;
        }

        return Notifications;
      })
      .catch(() => null);
  }

  return notificationsModulePromise;
}

function mapPermissionStatus(
  status: NotificationPermissionsStatus
): ReminderPermissionStatus {
  const granted = "granted" in status ? Boolean(status.granted) : false;
  const canAskAgain = "canAskAgain" in status ? Boolean(status.canAskAgain) : false;

  if (granted) {
    return "granted";
  }

  return canAskAgain ? "undetermined" : "denied";
}

function normalizeSettings(value: Partial<ReminderSettings> | null | undefined): ReminderSettings {
  const cadence = value?.cadence ?? DEFAULT_SETTINGS.cadence;
  const time = typeof value?.time === "string" && /^\d{2}:\d{2}$/.test(value.time)
    ? value.time
    : DEFAULT_SETTINGS.time;

  return {
    enabled: Boolean(value?.enabled),
    cadence,
    time,
    daysOfWeek: normalizeDaysOfWeek(cadence, value?.daysOfWeek),
    promptStyle: value?.promptStyle ?? DEFAULT_SETTINGS.promptStyle,
    lastUpdatedAt:
      typeof value?.lastUpdatedAt === "string" ? value.lastUpdatedAt : DEFAULT_SETTINGS.lastUpdatedAt,
  };
}

function normalizeDaysOfWeek(cadence: ReminderCadence, daysOfWeek?: number[]) {
  if (cadence === "weekdays") {
    return WEEKDAY_VALUES;
  }

  if (cadence === "weekly") {
    const cleanedDays = (daysOfWeek ?? [1]).filter((day) => day >= 1 && day <= 7);
    return cleanedDays.length ? [cleanedDays[0]] : [1];
  }

  return undefined;
}

function formatTimeLabel(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hour || 0, minute || 0, 0, 0).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDayName(day: number) {
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return labels[day - 1] ?? "Sunday";
}

function getPromptMessage(promptStyle: ReminderPromptStyle): ReminderMessage {
  switch (promptStyle) {
    case "family":
      return {
        title: "Tiny Chapters",
        body: "What's one moment from today you don't want to forget?",
      };
    case "reflection":
      return {
        title: "Tiny Chapters",
        body: "What mattered today, even a little?",
      };
    default:
      return {
        title: "Tiny Chapters",
        body: "Capture one small thing from today.",
      };
  }
}

function getScheduleDays(settings: ReminderSettings) {
  if (settings.cadence === "weekdays") {
    return WEEKDAY_VALUES;
  }

  if (settings.cadence === "weekly") {
    return normalizeDaysOfWeek("weekly", settings.daysOfWeek) ?? [1];
  }

  return [];
}

function buildDailyTrigger(settings: ReminderSettings): SchedulableNotificationTriggerInput {
  const [hour, minute] = settings.time.split(":").map(Number);

  return {
    type: "daily" as SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
    channelId: REMINDER_CHANNEL_ID,
  };
}

function buildWeeklyTrigger(
  day: number,
  settings: ReminderSettings
): SchedulableNotificationTriggerInput {
  const [hour, minute] = settings.time.split(":").map(Number);

  return {
    type: "weekly" as SchedulableTriggerInputTypes.WEEKLY,
    weekday: day,
    hour,
    minute,
    channelId: REMINDER_CHANNEL_ID,
  };
}

async function saveScheduledReminderIds(ids: string[]) {
  await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(ids));
}

async function getScheduledReminderIds() {
  const raw = await AsyncStorage.getItem(REMINDER_IDS_KEY);
  if (!raw) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [] as string[];
  }
}

export async function getScheduledReminderCount() {
  return (await getScheduledReminderIds()).length;
}

export async function configureReminderNotifications() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: "Memory reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#B86A4A",
    });
  }
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(REMINDER_SETTINGS_KEY);

  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    return normalizeSettings(JSON.parse(raw) as Partial<ReminderSettings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings) {
  const normalizedSettings = normalizeSettings(settings);
  await AsyncStorage.setItem(
    REMINDER_SETTINGS_KEY,
    JSON.stringify({
      ...normalizedSettings,
      lastUpdatedAt: new Date().toISOString(),
    } satisfies ReminderSettings)
  );
}

export async function getNotificationPermissionStatus(): Promise<ReminderPermissionStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return "denied";
  }

  const status = await Notifications.getPermissionsAsync();
  return mapPermissionStatus(status);
}

export async function requestNotificationPermission(): Promise<ReminderPermissionStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return "denied";
  }

  const status = await Notifications.requestPermissionsAsync();
  return mapPermissionStatus(status);
}

export async function cancelMemoryReminders() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    await saveScheduledReminderIds([]);
    return;
  }

  const scheduledIds = await getScheduledReminderIds();

  await Promise.all(
    scheduledIds.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // Ignore individual cancel failures so cleanup stays resilient.
      }
    })
  );

  await saveScheduledReminderIds([]);
}

export async function scheduleMemoryReminder(settings: ReminderSettings) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return [];
  }

  await configureReminderNotifications();
  const normalizedSettings = normalizeSettings(settings);

  if (!normalizedSettings.enabled) {
    await cancelMemoryReminders();
    return [];
  }

  const permissionStatus = await getNotificationPermissionStatus();
  if (permissionStatus !== "granted") {
    return [];
  }

  await cancelMemoryReminders();

  const message = getPromptMessage(normalizedSettings.promptStyle);
  const ids: string[] = [];

  if (normalizedSettings.cadence === "daily") {
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: {
          title: message.title,
          body: message.body,
          data: {
            kind: "memory_reminder",
            route: "/(tabs)",
          },
        },
        trigger: buildDailyTrigger(normalizedSettings),
      })
    );
  } else {
    for (const day of getScheduleDays(normalizedSettings)) {
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content: {
            title: message.title,
            body: message.body,
            data: {
              kind: "memory_reminder",
              route: "/(tabs)",
            },
          },
          trigger: buildWeeklyTrigger(day, normalizedSettings),
        })
      );
    }
  }

  await saveScheduledReminderIds(ids);
  return ids;
}

export async function rescheduleMemoryReminders() {
  const settings = await getReminderSettings();
  return scheduleMemoryReminder(settings);
}

export async function sendTestMemoryReminder(promptStyle: ReminderPromptStyle) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  await configureReminderNotifications();
  const permissionStatus = await getNotificationPermissionStatus();
  if (permissionStatus !== "granted") {
    return null;
  }

  const message = getPromptMessage(promptStyle);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: message.title,
      body: message.body,
      data: {
        kind: "memory_reminder",
        route: "/(tabs)",
      },
    },
    trigger: {
      type: "date",
      date: new Date(Date.now() + 5000),
      channelId: REMINDER_CHANNEL_ID,
    } as NotificationTriggerInput,
  });
}

export async function getNextReminderDate(settings?: ReminderSettings) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  const activeSettings = settings ?? (await getReminderSettings());
  const normalizedSettings = normalizeSettings(activeSettings);

  if (!normalizedSettings.enabled) {
    return null;
  }

  const triggerTimestamps =
    normalizedSettings.cadence === "daily"
      ? [await Notifications.getNextTriggerDateAsync(buildDailyTrigger(normalizedSettings))]
      : await Promise.all(
          getScheduleDays(normalizedSettings).map((day) =>
            Notifications.getNextTriggerDateAsync(buildWeeklyTrigger(day, normalizedSettings))
          )
        );

  return triggerTimestamps
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right)[0] ?? null;
}

export function getReminderDescription(settings: ReminderSettings) {
  const timeLabel = formatTimeLabel(settings.time);

  switch (settings.cadence) {
    case "weekdays":
      return `You'll be reminded at ${timeLabel} on weekdays.`;
    case "weekly":
      return `You'll be reminded at ${timeLabel} every ${getDayName(
        normalizeDaysOfWeek("weekly", settings.daysOfWeek)?.[0] ?? 1
      )}.`;
    default:
      return `You'll be reminded every day at ${timeLabel}.`;
  }
}

export async function addReminderResponseListener(
  onReminderTap: (data: { kind?: string; route?: string } | undefined) => void
) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return () => {};
  }

  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  if (lastResponse) {
    onReminderTap(
      lastResponse.notification.request.content.data as
        | { kind?: string; route?: string }
        | undefined
    );
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onReminderTap(
      response.notification.request.content.data as
        | { kind?: string; route?: string }
        | undefined
    );
  });

  return () => {
    subscription.remove();
  };
}
