import type { DashboardCard } from "@/features/dashboard/dashboardTypes";
import type { Memory } from "@/types/memory";

type GetDashboardCardsOptions = {
  date: Date;
  dailyPrompt: string;
  sameDayMemoryCount: number;
  onThisDayMemories: Memory[];
  resurfacedMemory: Memory | null;
};

function sortCardsByPriority(cards: DashboardCard[]) {
  return [...cards].sort((left, right) => left.priority - right.priority);
}

function getYearsAgoLabel(memoryDate: string, currentDate: Date) {
  return currentDate.getUTCFullYear() - new Date(memoryDate).getUTCFullYear();
}

function getResurfacedTimeframeLabel() {
  return "From another day in your archive";
}

export async function getDashboardCardsForToday({
  date,
  dailyPrompt,
  sameDayMemoryCount,
  onThisDayMemories,
  resurfacedMemory,
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
        helperText:
          sameDayMemoryCount > 0
            ? `You already saved ${sameDayMemoryCount} ${sameDayMemoryCount === 1 ? "memory" : "memories"} for this day. This question is here to open a fresh angle.`
            : "A tiny answer is enough. You can always add more later.",
      },
      action: {
        kind: "focus_memory_editor",
        label: sameDayMemoryCount > 0 ? "Add another memory" : "Start writing",
      },
    },
    {
      id: "resurfaced-memory",
      type: "resurfaced_memory",
      title: "A memory from another stretch of life",
      subtitle: getResurfacedTimeframeLabel(),
      description: resurfacedMemory
        ? "A random earlier moment to bring back into view."
        : "Once you have memories from earlier days, Tiny Chapters can surface a random one here.",
      priority: 3,
      payload: resurfacedMemory
        ? {
            state: "ready",
            timeframeLabel: getResurfacedTimeframeLabel(),
            memory: {
              id: resurfacedMemory.id,
              date: resurfacedMemory.date,
              prompt: resurfacedMemory.prompt,
              text: resurfacedMemory.text,
              photoCount: resurfacedMemory.attachedPhotos.length,
            },
          }
        : {
            state: "empty",
            timeframeLabel: getResurfacedTimeframeLabel(),
          },
      action: resurfacedMemory
        ? {
            kind: "refresh_resurfaced_memory",
            label: "Show another memory",
          }
        : {
            kind: "open_timeline",
            label: "Browse all memories",
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
