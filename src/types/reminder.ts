export type ReminderCadence = "daily" | "weekdays" | "weekly";
export type ReminderPromptStyle = "simple" | "family" | "reflection";
export type ReminderPermissionStatus = "granted" | "denied" | "undetermined";

export type ReminderSettings = {
  enabled: boolean;
  cadence: ReminderCadence;
  time: string;
  daysOfWeek?: number[];
  promptStyle: ReminderPromptStyle;
  lastUpdatedAt: string;
};
