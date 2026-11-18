import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/authenticated-request";

const TASK_XP = [20, 35, 10, 15] as const;
const DAY_COMPLETION_XP = 50;

function dateKeyInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getCurrentStreak(completedAtValues: Array<string | null>, timeZone: string): number {
  const activeDates = new Set(
    completedAtValues
      .filter((value): value is string => Boolean(value))
      .map((value) => {
        try {
          return dateKeyInZone(new Date(value), timeZone);
        } catch {
          return null;
        }
      })
      .filter((value): value is string => Boolean(value)),
  );

  const today = new Date();
  let anchor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const todayKey = dateKeyInZone(today, timeZone);
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
    const [profile, goals, paths, items, progress] = await Promise.all([
      db.from("profiles").select("*").eq("id", id).maybeSingle(),
      db.from("learning_goals").select("*").eq("user_id", id).order("priority"),
      db.from("learning_paths").select("*").eq("user_id", id).order("created_at", { ascending: false }),
      db.from("learning_path_items").select("*").eq("user_id", id).order("position"),
      db.from("learning_progress").select("*").eq("user_id", id),
    ]);

    if (profile.error || goals.error || paths.error || items.error || progress.error) {
      throw new InternalServerErrorException("Unable to load your learning workspace.");
    }

    const progressMap = new Map((progress.data ?? []).map((entry) => [entry.path_item_id, entry]));
    const hydrated = (items.data ?? []).map((item) => {
      const saved = progressMap.get(item.id);
      return {
        ...item,
        progress: saved?.status ?? item.status,
        reflection: saved?.reflection ?? "",
        completedAt: saved?.completed_at ?? null,
      };
    });
    const pathRows = (paths.data ?? []).map((path) => ({
      ...path,
      items: hydrated.filter((item) => item.path_id === path.id),
    }));
    const goalRows = (goals.data ?? []).map((goal) => ({
      ...goal,
      paths: pathRows.filter((path) => path.goal_id === goal.id),
    }));

    const done = hydrated.filter((item) => item.progress === "completed").length;
    const completedAtValues = (progress.data ?? [])
      .filter((entry) => entry.status === "completed")
      .map((entry) => entry.completed_at as string | null);

    let xp = 0;
    let completedDays = 0;
    for (const path of pathRows) {
      const completedPositions = new Set(
        path.items
          .filter((item) => item.progress === "completed")
          .map((item) => item.position),
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

    const timezone = profile.data?.timezone || "Asia/Kolkata";
    const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const completedThisWeek = (progress.data ?? []).filter(
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
