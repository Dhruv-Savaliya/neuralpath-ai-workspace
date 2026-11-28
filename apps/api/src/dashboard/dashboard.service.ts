import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/authenticated-request";

import { readAllPages } from "../common/read-all-pages";

const TASK_XP = [20, 35, 10, 15] as const;
const DAY_COMPLETION_XP = 50;

function dateKeyInZone(date: Date, formatter: Intl.DateTimeFormat): string {
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getCurrentStreak(completedAtValues: Array<string | null>, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const activeDates = new Set(
    completedAtValues
      .filter((value): value is string => Boolean(value))
      .map((value) => {
        try {
          return dateKeyInZone(new Date(value), formatter);
        } catch {
          return null;
        }
      })
      .filter((value): value is string => Boolean(value)),
  );

  const todayKey = dateKeyInZone(new Date(), formatter);
  const [year, month, day] = todayKey.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day));
  if (!activeDates.has(todayKey)) anchor.setUTCDate(anchor.getUTCDate() - 1);

  let streak = 0;
  while (activeDates.has(anchor.toISOString().slice(0, 10))) {
    streak += 1;
    anchor.setUTCDate(anchor.getUTCDate() - 1);
  }
  return streak;
}

@Injectable()
export class DashboardService {
  async getForUser(req: AuthenticatedRequest) {
    const id = req.user.id;
    const db = req.supabase;
    function readOwnedRows(table: string) {
      return readAllPages((after, limit) => {
        const query = db.from(table).select("*").eq("user_id", id).order("id").limit(limit);
        return after ? query.gt("id", after) : query;
      }, "Unable to load your learning workspace.");
    }
    const [profile, goals, paths, items, progress] = await Promise.all([
      db.from("profiles").select("*").eq("id", id).maybeSingle(),
      readOwnedRows("learning_goals"),
      readOwnedRows("learning_paths"),
      readOwnedRows("learning_path_items"),
      readOwnedRows("learning_progress"),
    ]);

    if (profile.error) {
      throw new InternalServerErrorException("Unable to load your learning workspace.");
    }

    const progressMap = new Map(progress.map((entry) => [entry.path_item_id, entry]));
    const hydrated = items.sort((a, b) => a.position - b.position).map((item) => {
      const saved = progressMap.get(item.id);
      return {
        ...item,
        progress: saved?.status ?? item.status,
        reflection: saved?.reflection ?? "",
        completedAt: saved?.completed_at ?? null,
      };
    });
    const pathRows = paths.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((path) => ({
      ...path,
      items: hydrated.filter((item) => item.path_id === path.id),
    }));
    const goalRows = goals.sort((a, b) => a.priority - b.priority).map((goal) => ({
      ...goal,
      paths: pathRows.filter((path) => path.goal_id === goal.id),
    }));

    const done = hydrated.filter((item) => item.progress === "completed").length;
    const completedAtValues = progress
      .filter((entry) => entry.status === "completed")
      .map((entry) => entry.completed_at as string | null);

    let xp = 0;
    let completedDays = 0;
    for (const path of pathRows) {
      const completedPositions = new Set<number>(
        path.items
          .filter((item: { progress: string }) => item.progress === "completed")
          .map((item: { position: number }) => item.position),
      );
      for (const position of completedPositions) xp += TASK_XP[position % 4] ?? 0;
      for (let day = 0; day < 45; day += 1) {
        const firstPosition = day * 4;
        if ([0, 1, 2, 3].every((offset) => completedPositions.has(firstPosition + offset))) {
          completedDays += 1;
          xp += DAY_COMPLETION_XP;
        }
      }
    }

    let timezone = profile.data?.timezone || "Asia/Kolkata";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      timezone = "Asia/Kolkata";
    }
    const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const completedThisWeek = progress.filter(
      (entry) =>
        entry.status === "completed" &&
        entry.completed_at &&
        new Date(entry.completed_at).getTime() >= weekStart,
    ).length;

    return {
      profile: profile.data,
      goals: goalRows,
      paths: pathRows,
      stats: {
        totalGoals: goalRows.length,
        activeGoals: goalRows.filter((goal) => goal.status === "active").length,
        totalPaths: pathRows.length,
        totalItems: hydrated.length,
        completedItems: done,
        completedDays,
        progressPercent: hydrated.length ? Math.round((done / hydrated.length) * 100) : 0,
        completedThisWeek,
        currentStreak: getCurrentStreak(completedAtValues, timezone),
        xp,
      },
    };
  }
}
