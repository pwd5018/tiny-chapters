import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { FadeInView } from "@/components/FadeInView";
import { DashboardCardList } from "@/features/dashboard/components/DashboardCardList";
import { getDashboardCardsForToday } from "@/features/dashboard/dashboardService";
import type { DashboardCard as DashboardCardModel } from "@/features/dashboard/dashboardTypes";
import { useMemoryService } from "@/services/memoryService";
import {
  getNotificationPermissionStatus,
  getReminderDescription,
  getReminderSettings,
  isReminderNotificationsSupported,
} from "@/services/notifications/reminderService";
import { theme } from "@/theme/theme";
import type { ReminderSettings } from "@/types/reminder";

export default function TodayScreen() {
  const router = useRouter();
  const { getDailyPrompt, getMemoryCountForDate, getOnThisDayMemories, getRandomResurfacedMemory } =
    useMemoryService();

  const [dashboardCards, setDashboardCards] = useState<DashboardCardModel[]>([]);
  const [dashboardErrorMessage, setDashboardErrorMessage] = useState("");
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [dailyPrompt, setDailyPrompt] = useState("What made today worth remembering?");
  const [sameDayMemoryCount, setSameDayMemoryCount] = useState(0);
  const [dashboardOnThisDayMemories, setDashboardOnThisDayMemories] = useState<
    Awaited<ReturnType<typeof getOnThisDayMemories>>
  >([]);
  const [resurfacedMemory, setResurfacedMemory] = useState<
    Awaited<ReturnType<typeof getRandomResurfacedMemory>>
  >(null);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings | null>(null);
  const [reminderPermission, setReminderPermission] = useState<
    "granted" | "denied" | "undetermined"
  >("undetermined");

  const today = useMemo(() => new Date(), []);

  const loadResurfacedMemory = useCallback(
    async (excludeIds?: string[]) => {
      const nextMemory = await getRandomResurfacedMemory(today, {
        minAgeDays: 30,
        excludeIds,
      });
      setResurfacedMemory(nextMemory);
    },
    [getRandomResurfacedMemory, today]
  );

  const loadDashboardData = useCallback(() => {
    let isActive = true;

    async function loadDashboardData() {
      setIsLoadingDashboard(true);
      setDashboardErrorMessage("");

      try {
        const [nextDailyPrompt, nextSameDayMemoryCount, onThisDayMemories, nextResurfacedMemory] =
          await Promise.all([
          getDailyPrompt(today),
          getMemoryCountForDate(today),
          getOnThisDayMemories(today, { limit: 3 }),
          getRandomResurfacedMemory(today, { minAgeDays: 30 }),
        ]);

        if (!isActive) {
          return;
        }

        setDailyPrompt(nextDailyPrompt);
        setSameDayMemoryCount(nextSameDayMemoryCount);
        setDashboardOnThisDayMemories(onThisDayMemories);
        setResurfacedMemory(nextResurfacedMemory);
      } catch (error) {
        if (isActive) {
          setDashboardErrorMessage(
            error instanceof Error ? error.message : "Could not load today's dashboard."
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingDashboard(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      isActive = false;
    };
  }, [getDailyPrompt, getMemoryCountForDate, getOnThisDayMemories, getRandomResurfacedMemory, today]);

  useFocusEffect(loadDashboardData);

  useEffect(() => {
    let isActive = true;

    async function buildDashboardCards() {
      if (dashboardErrorMessage) {
        return;
      }

      try {
        const cards = await getDashboardCardsForToday({
          date: today,
          dailyPrompt,
          sameDayMemoryCount,
          onThisDayMemories: dashboardOnThisDayMemories,
          resurfacedMemory,
        });

        if (isActive) {
          setDashboardCards(cards);
        }
      } catch (error) {
        if (isActive) {
          setDashboardCards([]);
          setDashboardErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not assemble today's dashboard."
          );
        }
      }
    }

    void buildDashboardCards();

    return () => {
      isActive = false;
    };
  }, [
    dailyPrompt,
    dashboardErrorMessage,
    dashboardOnThisDayMemories,
    resurfacedMemory,
    sameDayMemoryCount,
    today,
  ]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadReminderState() {
        try {
          const [settings, permission] = await Promise.all([
            getReminderSettings(),
            getNotificationPermissionStatus(),
          ]);

          if (!isActive) {
            return;
          }

          setReminderSettings(settings);
          setReminderPermission(permission);
        } catch {
          if (isActive) {
            setReminderSettings(null);
          }
        }
      }

      void loadReminderState();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const formattedDate = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const handleDashboardAction = (card: DashboardCardModel) => {
    switch (card.action?.kind) {
      case "focus_memory_editor":
        router.push("/write" as never);
        break;
      case "open_timeline":
        router.push("/(tabs)/timeline" as never);
        break;
      case "refresh_resurfaced_memory":
        void loadResurfacedMemory(resurfacedMemory ? [resurfacedMemory.id] : []);
        break;
      default:
        break;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <FadeInView>
        <View style={styles.heroCard}>
          <View style={styles.heroOrbLarge} />
          <View style={styles.heroOrbSmall} />
          <View style={styles.heroHeader}>
            <Text style={styles.eyebrow}>Tiny Chapters</Text>
            <Text style={styles.date}>{formattedDate}</Text>
          </View>
        </View>
      </FadeInView>

      {isReminderNotificationsSupported() &&
      reminderSettings?.enabled &&
      reminderPermission === "granted" ? (
        <FadeInView delay={70}>
          <View style={styles.reminderHintCard}>
            <View style={styles.reminderHintDot} />
            <View style={styles.reminderHintCopy}>
              <Text style={styles.reminderHintTitle}>Memory reminders are on</Text>
              <Text style={styles.reminderHintText}>
                {getReminderDescription(reminderSettings)}
              </Text>
            </View>
          </View>
        </FadeInView>
      ) : null}

      <FadeInView delay={130}>
        <DashboardCardList
          cards={dashboardCards}
          isLoading={isLoadingDashboard}
          errorMessage={dashboardErrorMessage}
          onActionPress={handleDashboardAction}
        />
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md + 2,
    position: "relative",
  },
  heroOrbLarge: {
    backgroundColor: "#EFD4B8",
    borderRadius: 999,
    height: 132,
    opacity: 0.42,
    position: "absolute",
    right: -32,
    top: -28,
    width: 132,
  },
  heroOrbSmall: {
    backgroundColor: "#E7BA9D",
    borderRadius: 999,
    height: 64,
    opacity: 0.28,
    position: "absolute",
    right: 34,
    top: 36,
    width: 64,
  },
  heroHeader: {
    gap: 4,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  date: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
  },
  reminderHintCard: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFF6EC",
    borderColor: "#E8D8C7",
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  reminderHintDot: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  reminderHintCopy: {
    gap: 2,
  },
  reminderHintTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  reminderHintText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    lineHeight: 18,
  },
});
