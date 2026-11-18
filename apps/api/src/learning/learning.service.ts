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

const PHASES = [
  { name: "Python foundations", firstDay: 1, lastDay: 7 },
  { name: "Math & data", firstDay: 8, lastDay: 12 },
  { name: "Machine learning", firstDay: 13, lastDay: 20 },
  { name: "Deep learning", firstDay: 21, lastDay: 25 },
  { name: "LLMs & GenAI", firstDay: 26, lastDay: 32 },
  { name: "AI application engineering", firstDay: 33, lastDay: 38 },
  { name: "Portfolio & shipping", firstDay: 39, lastDay: 45 },
] as const;

@Injectable()
export class LearningService {
  constructor(private readonly ai: AiService) {}

  private async loadContext(req: AuthenticatedRequest) {
    const userId = req.user.id;
    const db = req.supabase;
    const [profileResult, preferencesResult, goalsResult, pathsResult, itemsResult, progressResult] =
      await Promise.all([
        db.from("profiles").select("display_name,timezone,experience_level,interests").eq("id", userId).maybeSingle(),
        db.from("learner_preferences").select("learning_formats,learning_pace,weekly_minutes,language_code,preferred_days").eq("user_id", userId).maybeSingle(),
        db.from("learning_goals").select("id,title,category,status,priority,target_date,weekly_minutes").eq("user_id", userId).order("priority", { ascending: true }),
        db.from("learning_paths").select("id,title,status,goal_id").eq("user_id", userId).order("created_at", { ascending: false }),
        db.from("learning_path_items").select("id,path_id,title,description,position,status").eq("user_id", userId).order("position", { ascending: true }),
        db.from("learning_progress").select("path_item_id,status,completed_at,reflection").eq("user_id", userId),
      ]);

    if ([profileResult, preferencesResult, goalsResult, pathsResult, itemsResult, progressResult].some(result => result.error)) {
      throw new InternalServerErrorException("Unable to load learner data.");
    }

    let timeZone = profileResult.data?.timezone || "Asia/Kolkata";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
    } catch {
      timeZone = "Asia/Kolkata";
    }

    const goals = goalsResult.data ?? [];
    const paths = pathsResult.data ?? [];
    const selectedPath = paths.find(path => path.status === "active") ?? paths[0] ?? null;
    const progressRows = progressResult.data ?? [];
    const progressByItem = new Map(progressRows.map(row => [row.path_item_id, row]));
    const pathItems = selectedPath
      ? (itemsResult.data ?? []).filter(item => item.path_id === selectedPath.id)
      : [];
    const completedItems = pathItems.filter(item =>
      (progressByItem.get(item.id)?.status ?? item.status) === "completed",
    );
    const completedDates = progressRows
      .filter(row => row.status === "completed" && row.completed_at)
      .map(row => row.completed_at as string);
    const activeGoals = goals.filter(goal => goal.status === "active");
    const now = Date.now();

    return {
      profile: profileResult.data,
      preferences: preferencesResult.data,
      goals: activeGoals,
      selectedPath,
      pathItems,
      progressRows,
      progressByItem,
      completedItems,
      completedDates,
      timeZone,
      now,
    };
  }

  async getInsights(req: AuthenticatedRequest) {
    const context = await this.loadContext(req);
    const {
      profile, preferences, goals, selectedPath, pathItems,
      progressByItem, completedItems, completedDates, timeZone, now,
    } = context;
    const completedPositions = new Set(completedItems.map(item => item.position));

    const phaseProgress = PHASES.map(phase => {
      const start = (phase.firstDay - 1) * 4;
      const end = phase.lastDay * 4;
      const phaseItems = pathItems.filter(item => item.position >= start && item.position < end);
      const done = phaseItems.filter(item => completedPositions.has(item.position)).length;
      return {
        name: phase.name, firstDay: phase.firstDay, lastDay: phase.lastDay,
        completedTasks: done, totalTasks: phaseItems.length,
        progressPercent: phaseItems.length ? Math.round((done / phaseItems.length) * 100) : 0,
      };
    });

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
        goals: goals.map(goal => ({ id: goal.id, title: goal.title, priority: goal.priority, targetDate: goal.target_date })),
        recentCompletions: completedDates.length,
        candidates,
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
    const result = await req.supabase
      .from("learning_recommendations")
      .update({ feedback: dto.feedback })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("accepted_at", null)
      .select("id")
      .maybeSingle();
    if (result.error) throw new InternalServerErrorException("Unable to save recommendation feedback.");
    if (!result.data) throw new NotFoundException("Recommendation was not found or already accepted.");
    return { saved: true, feedback: dto.feedback };
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
        .select("id")
        .eq("id", candidate.taskId)
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (owned.error || !owned.data) throw new NotFoundException("The recommended task is no longer available.");
    } else {
      throw new BadRequestException("Unsupported recommendation action.");
    }

    const accepted = await req.supabase
      .from("learning_recommendations")
      .update({ accepted_at: new Date().toISOString(), accepted_action: { kind: candidate.kind, taskId: candidate.taskId, actionValue: candidate.actionValue } })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("accepted_at", null)
      .select("id")
      .maybeSingle();
    if (accepted.error || !accepted.data) throw new InternalServerErrorException("Unable to record recommendation approval.");
    return { accepted: true, action: candidate.kind };
  }
}
