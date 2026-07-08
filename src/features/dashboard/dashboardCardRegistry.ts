import type { DashboardCard, DashboardCardType } from "@/features/dashboard/dashboardTypes";

type DashboardCardDefinition = {
  eyebrow: string;
  tone: "warm" | "default";
  getDescription?: (card: DashboardCard) => string | undefined;
};

const dashboardCardRegistry: Record<DashboardCardType, DashboardCardDefinition> = {
  daily_prompt: {
    eyebrow: "Today's Question",
    tone: "warm",
    getDescription: (card) =>
      card.type === "daily_prompt" ? card.payload.prompt : card.description,
  },
  on_this_day: {
    eyebrow: "On This Day",
    tone: "default",
  },
  system_notice: {
    eyebrow: "Notice",
    tone: "default",
  },
};

export function getDashboardCardDefinition(type: DashboardCardType) {
  return dashboardCardRegistry[type];
}
