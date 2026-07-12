import type { Memory } from "@/types/memory";

export type DashboardCardType =
  | "daily_prompt"
  | "on_this_day"
  | "resurfaced_memory"
  | "system_notice";

export type DashboardCardAction =
  | {
      kind: "focus_memory_editor";
      label: string;
    }
  | {
      kind: "open_timeline";
      label: string;
    }
  | {
      kind: "refresh_resurfaced_memory";
      label: string;
    };

type DashboardCardBase<TType extends DashboardCardType, TPayload> = {
  id: string;
  type: TType;
  title: string;
  subtitle?: string;
  description?: string;
  priority: number;
  payload: TPayload;
  action?: DashboardCardAction;
};

export type DailyPromptDashboardCard = DashboardCardBase<
  "daily_prompt",
  {
    prompt: string;
    helperText?: string;
  }
>;

export type OnThisDayDashboardCard = DashboardCardBase<
  "on_this_day",
  | {
      state: "empty";
      memories: [];
    }
  | {
      state: "ready";
      memories: Array<{
        id: Memory["id"];
        date: Memory["date"];
        prompt: Memory["prompt"];
        text: Memory["text"];
        photoCount: number;
        yearsAgo: number;
      }>;
    }
>;

export type SystemNoticeDashboardCard = DashboardCardBase<
  "system_notice",
  {
    tone: "info" | "warning";
  }
>;

export type ResurfacedMemoryDashboardCard = DashboardCardBase<
  "resurfaced_memory",
  | {
      state: "empty";
      timeframeLabel: string;
    }
  | {
      state: "ready";
      timeframeLabel: string;
      memory: {
        id: Memory["id"];
        date: Memory["date"];
        prompt: Memory["prompt"];
        text: Memory["text"];
        photoCount: number;
      };
    }
>;

export type DashboardCard =
  | DailyPromptDashboardCard
  | OnThisDayDashboardCard
  | ResurfacedMemoryDashboardCard
  | SystemNoticeDashboardCard;
