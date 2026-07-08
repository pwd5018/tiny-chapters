import type { DashboardCard } from "@/features/dashboard/dashboardTypes";
import type { Memory } from "@/types/memory";

type GetDashboardCardsOptions = {
  date: Date;
  dailyPrompt: string;
  onThisDayMemories: Memory[];
};

function sortCardsByPriority(cards: DashboardCard[]) {
  return [...cards].sort((left, right) => left.priority - right.priority);
}

function getYearsAgoLabel(memoryDate: string, currentDate: Date) {
  return currentDate.getUTCFullYear() - new Date(memoryDate).getUTCFullYear();
}

export async function getDashboardCardsForToday({
  date,
  dailyPrompt,
  onThisDayMemories,
}: GetDashboardCardsOptions): Promise<DashboardCard[]> {
  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const cards: DashboardCard[] = [
    {
      id: "daily-prompt",
      type: "daily_prompt",
      title: "Today's Question",
      subtitle: formattedDate,
      description: "What made today worth remembering?",
      priority: 1,
      payload: {
        prompt: dailyPrompt,
        helperText: "A tiny answer is enough. You can always add more later.",
      },
      action: {
        kind: "focus_memory_editor",
        label: "Start writing",
      },
    },
    {
      id: "on-this-day",
      type: "on_this_day",
      title: "On This Day",
      subtitle: onThisDayMemories.length
        ? `${onThisDayMemories.length} ${onThisDayMemories.length === 1 ? "memory" : "memories"} from this date in earlier years`
        : "No earlier memories for this date yet",
      description: onThisDayMemories.length
        ? "A few small moments from this day in past years."
        : "Keep saving memories and this card will start resurfacing them here.",
      priority: 2,
      payload: onThisDayMemories.length
        ? {
            state: "ready",
            memories: onThisDayMemories.map((memory) => ({
              id: memory.id,
              date: memory.date,
              prompt: memory.prompt,
              text: memory.text,
              photoCount: memory.attachedPhotos.length,
              yearsAgo: getYearsAgoLabel(memory.date, date),
            })),
          }
        : {
            state: "empty",
            memories: [],
          },
      action: {
        kind: "open_timeline",
        label: onThisDayMemories.length ? "Open timeline" : "Browse all memories",
      },
    },
  ];

  return Promise.resolve(sortCardsByPriority(cards));
}
