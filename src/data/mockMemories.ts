import type { Memory } from "@/types/memory";

export const mockMemories: Memory[] = [
  {
    id: "mem-1",
    date: "2026-06-12T19:30:00.000Z",
    prompt: "What made your family laugh today?",
    text: "Mila tried to teach the dog how to whisper and got more dramatic with every attempt.",
    tags: ["family", "funny", "dog"],
    attachedPhotos: [
      {
        photoId: "photo-2026-06-12-1",
        source: "mock",
        path: "/nas/family/2026/06/12/whisper-dog.jpg",
        attachedAt: "2026-06-12T19:42:00.000Z",
        contentHash: "mockhash-whisper-dog",
        syncStatus: "linked_to_nas",
      },
    ],
    createdAt: "2026-06-12T19:42:00.000Z",
    updatedAt: "2026-06-12T19:42:00.000Z",
  },
  {
    id: "mem-2",
    date: "2026-06-11T13:10:00.000Z",
    prompt: "What tiny moment felt worth keeping?",
    text: "Lunch got quiet for a second because everyone was watching rain bead down the window.",
    tags: ["quiet", "rain"],
    attachedPhotos: [
      {
        photoId: "photo-2026-06-11-1",
        source: "mock",
        path: "/nas/family/2026/06/11/rain-window.jpg",
        attachedAt: "2026-06-11T13:20:00.000Z",
        syncStatus: "linked_to_nas",
      },
    ],
    createdAt: "2026-06-11T13:20:00.000Z",
    updatedAt: "2026-06-11T13:20:00.000Z",
  },
  {
    id: "mem-3",
    date: "2026-06-09T23:00:00.000Z",
    prompt: "What did your kid say that you want to remember later?",
    text: "At bedtime, Theo said the moon looked like it forgot part of its pancake.",
    tags: ["kids", "bedtime"],
    attachedPhotos: [],
    createdAt: "2026-06-09T23:05:00.000Z",
    updatedAt: "2026-06-09T23:05:00.000Z",
  },
];
