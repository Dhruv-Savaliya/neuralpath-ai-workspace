import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/authenticated-request";

const PHASES = [
  { name: "Python foundations", firstDay: 1, lastDay: 7 },
  { name: "Math & data", firstDay: 8, lastDay: 12 },
  { name: "Machine learning", firstDay: 13, lastDay: 20 },
  { name: "Deep learning", firstDay: 21, lastDay: 25 },
  { name: "LLMs & GenAI", firstDay: 26, lastDay: 32 },
  { name: "AI application engineering", firstDay: 33, lastDay: 38 },
  { name: "Portfolio & shipping", firstDay: 39, lastDay: 45 },
] as const;

function localDateKey(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function streakFromDates(values: string[], timeZone: string): number {
  const dates = new Set(values.map((value) => localDateKey(new Date(value), timeZone)));
  const today = localDateKey(new Date(), timeZone);
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

@Injectable()
export class LearningService {
  async getInsights(req: AuthenticatedRequest) {
    const userId = req.user.id;
    const db = req.supabase;
    const [profileResult, preferencesResult, goalsResult, pathsResult, itemsResult, progressResult] =
      await Promise.all([
        db.from("profiles").select("display_name,timezone,experience_level,interests").eq("id", userId).maybeSingle(),
        db.from("learner_preferences").select("learning_formats,learning_pace,weekly_minutes,language_code,preferred_days").eq("user_id", userId).maybeSingle(),
        db.from("learning_goals").select("id,title,category,status,priority,target_date,weekly_minutes").eq("user_id", userId).order("priority", { ascending: true }),
        db.from("learning_paths").select("id,title,status,goal_id").eq("user_id", userId).order("created_at", { ascending: false }),
        db.from("learning_path_items").select("id,path_id,title,description,position,status").eq("user_id", userId).order("position", { ascending: true }),
        db.from("learning_progress").select("path_item_id,status,completed_at").eq("user_id", userId),
      ]);

    if (profileResult.error || preferencesResult.error || goalsResult.error || pathsResult.error || itemsResult.error || progressResult.error) {
      throw new InternalServerErrorException("Unable to load learner insights.");
    }

    let timeZone = profileResult.data?.timezone || "Asia/Kolkata";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
    } catch {
      timeZone = "Asia/Kolkata";
    }

    const goals = goalsResult.data ?? [];
    const paths = pathsResult.data ?? [];
    const selectedPath = paths.find((path) => path.status === "active") ?? paths[0] ?? null;
    const progressRows = progressResult.data ?? [];
    const progressByItem = new Map(progressRows.map((row) => [row.path_item_id, row]));
    const pathItems = selectedPath
      ? (itemsResult.data ?? []).filter((item) => item.path_id === selectedPath.id)
      : [];
    const completedItems = pathItems.filter((item) =>
      (progressByItem.get(item.id)?.status ?? item.status) === "completed",
    );
    const completedPositions = new Set(completedItems.map((item) => item.position));

    const phaseProgress = PHASES.map((phase) => {
      const start = (phase.firstDay - 1) * 4;
      const end = phase.lastDay * 4;
      const phaseItems = pathItems.filter((item) => item.position >= start && item.position < end);
      const done = phaseItems.filter((item) => completedPositions.has(item.position)).length;
      return {
        name: phase.name,
        firstDay: phase.firstDay,
        lastDay: phase.lastDay,
        completedTasks: done,
        totalTasks: phaseItems.length,
        progressPercent: phaseItems.length ? Math.round((done / phaseItems.length) * 100) : 0,
      };
    });

    const completedDates = progressRows
      .filter((row) => row.status === "completed" && row.completed_at)
      .map((row) => row.completed_at as string);
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const completedLast7Days = completedDates.filter((date) => new Date(date).getTime() >= sevenDaysAgo).length;
    const completedLast30Days = completedDates.filter((date) => new Date(date).getTime() >= thirtyDaysAgo).length;

    const nextTasks = pathItems
      .filter((item) => (progressByItem.get(item.id)?.status ?? item.status) !== "completed")
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        day: Math.floor(item.position / 4) + 1,
        status: progressByItem.get(item.id)?.status ?? item.status,
      }));

    const activeGoals = goals.filter((goal) => goal.status === "active");
    const goalInsights = activeGoals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      category: goal.category,
      priority: goal.priority,
      targetDate: goal.target_date,
      daysUntilTarget: goal.target_date
        ? Math.ceil((new Date(`${goal.target_date}T00:00:00Z`).getTime() - now) / (24 * 60 * 60 * 1000))
        : null,
      weeklyMinutes: goal.weekly_minutes,
    }));

    return {
      generatedAt: new Date().toISOString(),
      dataSource: "supabase",
      hasActivity: completedDates.length > 0,
      learner: {
        displayName: profileResult.data?.display_name || "",
        experienceLevel: profileResult.data?.experience_level || null,
        interests: profileResult.data?.interests ?? [],
        timezone: timeZone,
      },
      preferences: preferencesResult.data,
      goals: goalInsights,
      roadmap: {
        pathId: selectedPath?.id ?? null,
        title: selectedPath?.title ?? null,
        completedTasks: completedItems.length,
        totalTasks: pathItems.length,
        progressPercent: pathItems.length ? Math.round((completedItems.length / pathItems.length) * 100) : 0,
        nextTasks,
        phases: phaseProgress,
      },
      activity: {
        completedLast7Days,
        completedLast30Days,
        currentStreak: streakFromDates(completedDates, timeZone),
        lastCompletedAt: completedDates.length
          ? completedDates.map((date) => new Date(date).getTime()).sort((a, b) => b - a)[0]
          : null,
      },
      emptyState: {
        needsGoal: goals.length === 0,
        needsRoadmap: goals.length > 0 && !selectedPath,
        needsProgress: completedDates.length === 0,
      },
    };
  }
}
