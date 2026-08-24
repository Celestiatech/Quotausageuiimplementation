export type AnswerType = "text" | "choice" | "multiselect" | "boolean" | "number";
export type SourceType = "manual" | "extension_capture" | "system" | "resume_parse" | "linkedin_import";

export type CachedAnswerItem = {
  questionKey: string;
  questionLabel: string;
  answer: string;
  answerType: AnswerType;
  source: SourceType;
  lastUsed: string;
  updatedAt: string;
};

export type CachedUserAnswers = {
  answers: CachedAnswerItem[];
  cachedAtMs: number;
};

const userAnswersCache = new Map<string, CachedUserAnswers>();
export const CACHE_TTL_MS = 25_000; // 25 seconds cache

export function getUserAnswersCache(userId: string): CachedUserAnswers | undefined {
  return userAnswersCache.get(userId);
}

export function setUserAnswersCache(userId: string, data: CachedUserAnswers): void {
  userAnswersCache.set(userId, data);
}

export function invalidateUserAnswersCache(userId: string): void {
  userAnswersCache.delete(userId);
}
