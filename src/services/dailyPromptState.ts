import AsyncStorage from "@react-native-async-storage/async-storage";

const DAILY_PROMPT_CACHE_KEY = "tiny_chapters.daily_prompt_cache";

type DailyPromptCacheRecord = {
  prompt: string;
  updatedAt: string;
};

type DailyPromptCache = Record<string, DailyPromptCacheRecord>;

function getScopedCacheKey(userId: string, dateKey: string) {
  return `${userId}:${dateKey}`;
}

async function readDailyPromptCache(): Promise<DailyPromptCache> {
  const raw = await AsyncStorage.getItem(DAILY_PROMPT_CACHE_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([dateKey, value]) =>
          typeof dateKey === "string" &&
          Boolean(
            value &&
              typeof value === "object" &&
              typeof (value as DailyPromptCacheRecord).prompt === "string" &&
              typeof (value as DailyPromptCacheRecord).updatedAt === "string"
          )
      )
    );
  } catch {
    return {};
  }
}

async function writeDailyPromptCache(cache: DailyPromptCache) {
  await AsyncStorage.setItem(DAILY_PROMPT_CACHE_KEY, JSON.stringify(cache));
}

export async function getCachedDailyPrompt(userId: string, dateKey: string) {
  const cache = await readDailyPromptCache();
  return cache[getScopedCacheKey(userId, dateKey)]?.prompt?.trim() || null;
}

export async function setCachedDailyPrompt(userId: string, dateKey: string, prompt: string) {
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    return;
  }

  const cache = await readDailyPromptCache();
  cache[getScopedCacheKey(userId, dateKey)] = {
    prompt: trimmedPrompt,
    updatedAt: new Date().toISOString(),
  };
  await writeDailyPromptCache(cache);
}

export async function clearCachedDailyPrompt(userId: string, dateKey: string) {
  const cache = await readDailyPromptCache();
  const scopedCacheKey = getScopedCacheKey(userId, dateKey);

  if (!(scopedCacheKey in cache)) {
    return;
  }

  delete cache[scopedCacheKey];
  await writeDailyPromptCache(cache);
}
