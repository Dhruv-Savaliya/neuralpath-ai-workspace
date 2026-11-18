export type RecommendationCandidate = {
  candidateId: string;
  kind: "focus_task" | "adjust_weekly_minutes";
  taskId: string | null;
  goalId: string | null;
  title: string;
  actionValue: number | null;
  estimatedMinutes: number;
};

export type RankedRecommendation = RecommendationCandidate & {
  reason: string;
  priority: number;
};

export function localDateKey(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function streakFromDates(values: string[], timeZone: string, now = new Date()): number {
  const dates = new Set(values.filter(Boolean).map((value) => localDateKey(new Date(value), timeZone)));
  const today = localDateKey(now, timeZone);
  const [year, month, day] = today.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  if (!dates.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function countWithinDays(values: string[], days: number, now = Date.now()): number {
  const threshold = now - days * 24 * 60 * 60 * 1000;
  return values.filter((value) => {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp >= threshold && timestamp <= now;
  }).length;
}

export function validateRankedRecommendations(
  raw: unknown,
  candidates: RecommendationCandidate[],
): RankedRecommendation[] {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { recommendations?: unknown }).recommendations)) {
    return [];
  }
  const allowed = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const seen = new Set<string>();
  const result: RankedRecommendation[] = [];
  for (const item of (raw as { recommendations: unknown[] }).recommendations.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const value = item as Record<string, unknown>;
    const candidate = allowed.get(String(value.candidateId ?? ""));
    if (!candidate || seen.has(candidate.candidateId)) continue;
    const reason = typeof value.reason === "string" ? value.reason.trim().slice(0, 400) : "";
    const priority = Number(value.priority);
    if (!reason || !Number.isInteger(priority) || priority < 1 || priority > 3) continue;
    result.push({ ...candidate, reason, priority });
    seen.add(candidate.candidateId);
  }
  return result.sort((a, b) => a.priority - b.priority);
}

export function fallbackRecommendations(candidates: RecommendationCandidate[]): RankedRecommendation[] {
  return candidates.slice(0, 3).map((candidate, index) => ({
    ...candidate,
    reason: candidate.kind === "focus_task"
      ? "This is the next incomplete task in your saved roadmap."
      : "This adjusts your saved weekly study target to a more manageable level based on your recent activity.",
    priority: index + 1,
  }));
}
