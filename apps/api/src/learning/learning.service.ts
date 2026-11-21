import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import { AiService } from "../ai/ai.service";
import {
  countWithinDays,
  fallbackRecommendations,
  streakFromDates,
  validateRankedRecommendations,
  type RecommendationCandidate,
} from "./learning.logic";
import type { RecommendationFeedbackDto } from "./dto/recommendation-feedback.dto";
import type { AcceptRecommendationDto } from "./dto/accept-recommendation.dto";

const PHASE_LENGTH_DAYS = 7;

function topicForDay(items: Array<{ title: string; description: string }>, day: number): string {
  const item = items.find(candidate => {
    const titleDay = Number(candidate.title.match(/^Day\s+(\d+)/i)?.[1]);
    return titleDay === day;
  });
  if (!item) return "";
  const description = item.description.trim();
  const separator = description.search(/\s[—–-]\s/);
  const fromDescription = separator > 0 ? description.slice(0, separator).trim() : "";
  const fromTitle = item.title
    .replace(/^Day\s+\d+\s*:\s*/i, "")
    .replace(/^(lesson|exercise|resource|project)\s*[—–:-]\s*/i, "")
    .trim();
  return (fromDescription || fromTitle).slice(0, 64);
}

function buildRoadmapPhases(
  pathItems: Array<{ title: string; description: string; position: number; status: string }>,
  completedPositions: Set<number>,
) {
  if (!pathItems.length) return [];
  const maxDay = Math.ceil((Math.max(...pathItems.map(item => item.position)) + 1) / 4);
  const phases = [];
  for (let firstDay = 1; firstDay <= maxDay; firstDay += PHASE_LENGTH_DAYS) {
    const lastDay = Math.min(firstDay + PHASE_LENGTH_DAYS - 1, maxDay);
    const startPosition = (firstDay - 1) * 4;
    const endPosition = lastDay * 4;
    const phaseItems = pathItems.filter(item => item.position >= startPosition && item.position < endPosition);
    const topic = topicForDay(pathItems, firstDay);
    const completedTasks = phaseItems.filter(item => completedPositions.has(item.position)).length;
    phases.push({
      name: topic || `Learning days ${firstDay}–${lastDay}`,
      firstDay,
      lastDay,
      completedTasks,
      totalTasks: phaseItems.length,
      progressPercent: phaseItems.length ? Math.round(completedTasks / phaseItems.length * 100) : 0,
    });
  }
  return phases;
}

function weeklyActivity(values: string[], timeZone: string, now: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const dateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(value));
    const fields = Object.fromEntries(dateParts.map(part => [part.type, part.value]));
    const localDate = new Date(Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day)));
    localDate.setUTCDate(localDate.getUTCDate() - ((localDate.getUTCDay() + 6) % 7));
    const weekStart = localDate.toISOString().slice(0, 10);
    counts.set(weekStart, (counts.get(weekStart) ?? 0) + 1);
  }
  const currentParts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(now));
  const fields = Object.fromEntries(currentParts.map(part => [part.type, part.value]));
  const monday = new Date(Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day)));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(monday);
    start.setUTCDate(start.getUTCDate() - (5 - index) * 7);
    const weekStart = start.toISOString().slice(0, 10);
    return { weekStart, completedTasks: counts.get(weekStart) ?? 0 };
  });
}

@Injectable()
export class LearningService {
  constructor(private readonly ai: AiService) {}

  private async loadContext(req: AuthenticatedRequest) {
    const userId = req.user.id;
    const db = req.supabase;
    const now = Date.now();
    const activitySince = new Date(now - 365 * 86400000).toISOString();

    // Fetch only active goals and the active path first. Historical path rows
    // are not needed to generate current recommendations or dashboard context.
    const [profileResult, preferencesResult, goalsResult, activePathResult] =
      await Promise.all([
        db.from("profiles").select("display_name,timezone,experience_level,interests").eq("id", userId).maybeSingle(),
        db.from("learner_preferences").select("learning_formats,learning_pace,weekly_minutes,language_code,preferred_days").eq("user_id", userId).maybeSingle(),
        db.from("learning_goals").select("id,title,category,status,priority,target_date,weekly_minutes")
          .eq("user_id", userId).eq("status", "active").order("priority", { ascending: true }).limit(100),
        db.from("learning_paths").select("id,title,status,goal_id")
          .eq("user_id", userId).eq("status", "active")
          .order("created_at", { ascending: false }).limit(1),
      ]);

    if ([profileResult, preferencesResult, goalsResult, activePathResult].some(result => result.error)) {
      throw new InternalServerErrorException("Unable to load learner data.");
    }

    let selectedPath = activePathResult.data?.[0] ?? null;
    if (!selectedPath) {
      const fallbackPathResult = await db.from("learning_paths").select("id,title,status,goal_id")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
      if (fallbackPathResult.error) throw new InternalServerErrorException("Unable to load learner data.");
      selectedPath = fallbackPathResult.data?.[0] ?? null;
    }

    const itemsResult = selectedPath
      ? await db.from("learning_path_items").select("id,path_id,title,description,position,status")
          .eq("user_id", userId).eq("path_id", selectedPath.id)
          .order("position", { ascending: true }).limit(200)
      : { data: [], error: null };
    if (itemsResult.error) throw new InternalServerErrorException("Unable to load learner data.");

    const pathItemIds = (itemsResult.data ?? []).map(item => item.id);
    const [pathProgressResult, activityResult] = await Promise.all([
      pathItemIds.length
        ? db.from("learning_progress").select("path_item_id,status,completed_at,reflection")
            .eq("user_id", userId).in("path_item_id", pathItemIds).limit(200)
        : Promise.resolve({ data: [], error: null }),
      db.from("learning_progress").select("path_item_id,status,completed_at,reflection")
        .eq("user_id", userId).eq("status", "completed")
        .gte("completed_at", activitySince)
        .order("completed_at", { ascending: false }).limit(1000),
    ]);
    if (pathProgressResult.error || activityResult.error) {
      throw new InternalServerErrorException("Unable to load learner data.");
    }

    let timeZone = profileResult.data?.timezone || "Asia/Kolkata";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
    } catch {
      timeZone = "Asia/Kolkata";
    }

    const goals = goalsResult.data ?? [];
    const pathItems = (itemsResult.data ?? []) as Array<{ id: string; path_id: string; title: string; description: string; position: number; status: string }>;
    const progressRows = (activityResult.data ?? []) as Array<{ path_item_id: string; status: string; completed_at: string | null; reflection: string | null }>;
    const pathProgressRows = (pathProgressResult.data ?? []) as Array<{ path_item_id: string; status: string; completed_at: string | null; reflection: string | null }>;
    const progressByItem = new Map<string, (typeof pathProgressRows)[number]>(pathProgressRows.map(row => [row.path_item_id, row]));
    const completedItems = pathItems.filter(item =>
      (progressByItem.get(item.id)?.status ?? item.status) === "completed",
    );
    const completedDates = progressRows
      .flatMap(row => row.completed_at ? [row.completed_at] : []);
    const nowDate = now;

    return {
      profile: profileResult.data,
      preferences: preferencesResult.data,
      goals,
      selectedPath,
      pathItems,
      progressRows,
      progressByItem,
      completedItems,
      completedDates,
      timeZone,
      now: nowDate,
    };
  }

  async getInsights(req: AuthenticatedRequest) {
    const context = await this.loadContext(req);
    const {
      profile, preferences, goals, selectedPath, pathItems,
      progressByItem, completedItems, completedDates, timeZone, now,
    } = context;
    const completedPositions = new Set(completedItems.map(item => item.position));

    const phaseProgress = buildRoadmapPhases(pathItems, completedPositions);

    const nextTasks = pathItems
      .filter(item => (progressByItem.get(item.id)?.status ?? item.status) !== "completed")
      .slice(0, 5)
      .map(item => ({
        id: item.id, title: item.title, description: item.description,
        day: Math.floor(item.position / 4) + 1,
        status: progressByItem.get(item.id)?.status ?? item.status,
      }));

    return {
      generatedAt: new Date(now).toISOString(),
      dataSource: "supabase",
      hasActivity: completedDates.length > 0,
      learner: {
        displayName: profile?.display_name || "",
        experienceLevel: profile?.experience_level || null,
        interests: profile?.interests ?? [],
        timezone: timeZone,
      },
      preferences,
      goals: goals.map(goal => ({
        id: goal.id, title: goal.title, category: goal.category, priority: goal.priority,
        targetDate: goal.target_date,
        daysUntilTarget: goal.target_date
          ? Math.ceil((new Date(`${goal.target_date}T00:00:00Z`).getTime() - now) / 86400000)
          : null,
        weeklyMinutes: goal.weekly_minutes,
      })),
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
        completedLast7Days: countWithinDays(completedDates, 7, now),
        completedLast30Days: countWithinDays(completedDates, 30, now),
        weekly: weeklyActivity(completedDates, timeZone, now),
        currentStreak: streakFromDates(completedDates, timeZone, new Date(now)),
        lastCompletedAt: completedDates.length
          ? Math.max(...completedDates.map(date => new Date(date).getTime()))
          : null,
      },
      emptyState: {
        needsGoal: goals.length === 0,
        needsRoadmap: goals.length > 0 && !selectedPath,
        needsProgress: completedDates.length === 0,
      },
    };
  }

  async getRecommendations(req: AuthenticatedRequest) {
    const context = await this.loadContext(req);
    const { goals, preferences, selectedPath, pathItems, progressByItem, completedDates, now } = context;
    const incomplete = pathItems
      .filter(item => (progressByItem.get(item.id)?.status ?? item.status) !== "completed")
      .slice(0, 5);
    const candidates: RecommendationCandidate[] = incomplete.slice(0, 3).map((item, index) => ({
      candidateId: `task:${item.id}`,
      kind: "focus_task",
      taskId: item.id,
      goalId: selectedPath?.goal_id ?? null,
      title: item.title,
      actionValue: null,
      estimatedMinutes: 45,
    }));

    if (preferences && preferences.weekly_minutes > 60 && completedDates.length === 0) {
      candidates.push({
        candidateId: "pace:weekly-minutes",
        kind: "adjust_weekly_minutes",
        taskId: null,
        goalId: goals[0]?.id ?? null,
        title: "Try a lighter weekly study target",
        actionValue: Math.max(60, Math.round(preferences.weekly_minutes * 0.75 / 15) * 15),
        estimatedMinutes: 10,
      });
    }
    if (!candidates.length) {
      return { source: "deterministic", recommendations: [], message: "No active roadmap tasks need attention right now." };
    }

    const recent = await req.supabase
      .from("learning_recommendations")
      .select("id,payload,created_at")
      .eq("user_id", req.user.id)
      .is("accepted_at", null)
      .is("feedback", null)
      .gt("expires_at", new Date(now).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent.error) throw new InternalServerErrorException("Unable to load saved recommendations.");
    if (recent.data && now - new Date(recent.data.created_at).getTime() < 15 * 60 * 1000) {
      return { id: recent.data.id, source: recent.data.payload.source, recommendations: recent.data.payload.recommendations };
    }

    const prompt = [
      "You are NeuralPath's adaptive learning planner.",
      "Return ONLY valid JSON: { \"recommendations\": [{ \"candidateId\": string, \"reason\": string, \"priority\": 1|2|3 }] }.",
      "Use only candidateId values supplied below. Never invent tasks, goals, facts, or IDs.",
      "Give concise reasons grounded in the learner context. Do not propose changing progress or roadmap content.",
      JSON.stringify({
        learningPace: preferences?.learning_pace ?? "not set",
        weeklyMinutes: preferences?.weekly_minutes ?? null,
        learningFormats: preferences?.learning_formats ?? [],
        language: preferences?.language_code ?? "en",
        activeGoalCount: goals.length,
        goalPriorities: goals.map(goal => ({ category: goal.category, priority: goal.priority, daysToTarget: goal.target_date
          ? Math.ceil((new Date(`${goal.target_date}T00:00:00Z`).getTime() - now) / 86400000)
          : null })),
        recentCompletions: completedDates.length,
        candidates: candidates.map(({ candidateId, kind, title, estimatedMinutes }) => ({
          candidateId, kind, title, estimatedMinutes,
        })),
      }),
    ].join("\n");

    let recommendations = fallbackRecommendations(candidates);
    let source = "deterministic";
    try {
      const generated = await this.ai.generateForLearning(req, prompt);
      const rawText = generated.answer.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(rawText) as unknown;
      const validated = validateRankedRecommendations(parsed, candidates);
      if (validated.length) {
        recommendations = validated;
        source = generated.provider;
      }
    } catch {
      // Deterministic, server-derived recommendations remain available when the model is unavailable.
    }

    const payload = { source, recommendations };
    const inserted = await req.supabase
      .from("learning_recommendations")
      .insert({ user_id: req.user.id, payload })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      throw new InternalServerErrorException("Unable to save learning recommendations.");
    }
    return { id: inserted.data.id, ...payload };
  }

  async recordFeedback(req: AuthenticatedRequest, id: string, dto: RecommendationFeedbackDto) {
    const existing = await req.supabase
      .from("learning_recommendations")
      .select("id,payload,accepted_at,feedback")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (existing.error) throw new InternalServerErrorException("Unable to load recommendation feedback target.");
    if (!existing.data || existing.data.accepted_at || existing.data.feedback) {
      throw new NotFoundException("Recommendation was not found or is no longer actionable.");
    }
    const candidates = (existing.data.payload as { recommendations?: RecommendationCandidate[] }).recommendations ?? [];
    if (!candidates.some(candidate => candidate.candidateId === dto.candidateId)) {
      throw new BadRequestException("Feedback does not match a saved recommendation.");
    }
    const result = await req.supabase
      .from("learning_recommendations")
      .update({ feedback: dto.feedback, feedback_candidate_id: dto.candidateId })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("accepted_at", null)
      .is("feedback", null)
      .select("id")
      .maybeSingle();
    if (result.error) throw new InternalServerErrorException("Unable to save recommendation feedback.");
    if (!result.data) throw new NotFoundException("Recommendation was not found or already responded to.");
    return { saved: true, feedback: dto.feedback, candidateId: dto.candidateId };
  }

  async acceptRecommendation(req: AuthenticatedRequest, id: string, dto: AcceptRecommendationDto) {
    const result = await req.supabase
      .from("learning_recommendations")
      .select("id,payload,accepted_at,feedback")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (result.error) throw new InternalServerErrorException("Unable to load recommendation.");
    if (!result.data || result.data.accepted_at || result.data.feedback) {
      throw new NotFoundException("Recommendation was not found or is no longer actionable.");
    }

    const recommendations = (result.data.payload as { recommendations?: Array<RecommendationCandidate & { reason: string; priority: number }> }).recommendations ?? [];
    const candidate = recommendations.find(item => item.candidateId === dto.candidateId);
    if (!candidate) throw new BadRequestException("This recommendation has no action to accept.");

    if (candidate.kind === "adjust_weekly_minutes") {
      const minutes = candidate.actionValue;
      if (!Number.isInteger(minutes) || (minutes as number) < 15 || (minutes as number) > 3000) {
        throw new BadRequestException("The proposed weekly study target is invalid.");
      }
      const updated = await req.supabase
        .from("learner_preferences")
        .update({ weekly_minutes: minutes })
        .eq("user_id", req.user.id)
        .select("user_id")
        .maybeSingle();
      if (updated.error || !updated.data) {
        throw new InternalServerErrorException("Unable to apply the approved study target.");
      }
    } else if (candidate.kind === "focus_task") {
      const owned = await req.supabase
        .from("learning_path_items")
        .select("id,status")
        .eq("id", candidate.taskId)
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (owned.error || !owned.data || owned.data.status === "completed") {
        throw new NotFoundException("The recommended task is no longer available.");
      }
      const savedProgress = await req.supabase
        .from("learning_progress")
        .select("status")
        .eq("path_item_id", candidate.taskId)
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (savedProgress.error || savedProgress.data?.status === "completed") {
        throw new NotFoundException("This task is already completed.");
      }
    } else {
      throw new BadRequestException("Unsupported recommendation action.");
    }

    const accepted = await req.supabase
      .from("learning_recommendations")
      .update({ accepted_at: new Date().toISOString(), accepted_action: { kind: candidate.kind, taskId: candidate.taskId, actionValue: candidate.actionValue } })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("accepted_at", null)
      .is("feedback", null)
      .select("id")
      .maybeSingle();
    if (accepted.error || !accepted.data) throw new InternalServerErrorException("Unable to record recommendation approval.");
    return { accepted: true, action: candidate.kind };
  }
}
