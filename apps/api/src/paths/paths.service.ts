import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import type { BootstrapPathDto } from "./dto/bootstrap-path.dto";
import { AiService } from "../ai/ai.service";
import { buildAdaptiveCurriculumPrompt, classifyProjectDomain } from "./paths.logic";

type GeneratedTask = { title: string; description: string; item_type: "lesson" | "exercise" | "resource" | "project" };
type GeneratedDay = { day: number; title: string; focus: string; tasks: GeneratedTask[] };
type GeneratedCurriculum = { title: string; description: string; days: GeneratedDay[] };

const DAYS_PER_BATCH = 3;
const TOTAL_DAYS = 45;
const TASKS_PER_DAY = 4;

@Injectable()
export class PathsService {
  private readonly logger = new Logger(PathsService.name);

  constructor(private readonly ai: AiService) {}

  async bootstrap(req: AuthenticatedRequest, dto: BootstrapPathDto) {
    const userId = req.user.id;
    const db = req.supabase;
    const { data: goal, error: goalError } = await db.from("learning_goals")
      .select("id,title,category,desired_outcome,current_level,target_date,weekly_minutes")
      .eq("id", dto.goal_id).eq("user_id", userId).maybeSingle();
    if (goalError) throw new InternalServerErrorException("Unable to verify the learning goal.");
    if (!goal) throw new NotFoundException("Learning goal was not found.");

    const { data: profile, error: profileError } = await db.from("profiles")
      .select("display_name,profession,experience_level,interests,timezone,onboarding_completed")
      .eq("id", userId).maybeSingle();
    if (profileError) throw new InternalServerErrorException("Unable to load learner profile.");

    const { data: preferences, error: preferencesError } = await db.from("learner_preferences")
      .select("learning_formats,learning_pace,weekly_minutes,language_code,preferred_days")
      .eq("user_id", userId).maybeSingle();
    if (preferencesError) throw new InternalServerErrorException("Unable to load learner preferences.");

    const { data: existing, error: existingError } = await db.from("learning_paths")
      .select("*,items:learning_path_items(*)")
      .eq("user_id", userId).eq("goal_id", goal.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existingError) throw new InternalServerErrorException("Unable to load the learning path.");
    const existingItems = [...(existing?.items ?? [])].sort((a, b) => a.position - b.position);
    const existingCount = existingItems.length;
    const recoverablePartial = Boolean(existing && existing.status === "in_progress" &&
      existingCount < TOTAL_DAYS * TASKS_PER_DAY &&
      existingCount % TASKS_PER_DAY === 0 &&
      existingItems.every((item, index) => item.position === index));
    if (existingCount && !recoverablePartial) {
      return { ...existing, items: existingItems };
    }
    if (existing && !existingCount && existing.status !== "in_progress") {
      return { ...existing, items: [] };
    }

    const domain = classifyProjectDomain(goal, profile);
    const resumeStartDay = recoverablePartial ? existingCount / TASKS_PER_DAY + 1 : 1;
    if (!profile?.onboarding_completed) {
      throw new BadRequestException("Complete your onboarding profile before generating a personalized learning path.");
    }
    const days: GeneratedDay[] = [];

    // Three-day independently validated batches keep JSON responses below Groq's observed output-token ceiling.
    for (let startDay = resumeStartDay; startDay <= TOTAL_DAYS; startDay += DAYS_PER_BATCH) {
      const endDay = Math.min(startDay + DAYS_PER_BATCH - 1, TOTAL_DAYS);
      const previousSummary = [
        ...existingItems.slice(-20).map(item => ({
          day: Math.floor(item.position / TASKS_PER_DAY) + 1,
          task: item.title,
          detail: String(item.description ?? "").slice(0, 100),
        })),
        ...days.slice(-5).map(day => ({ day: day.day, title: day.title, focus: day.focus })),
      ].slice(-20).map(value => JSON.stringify(value)).join("\n");
      const prompt = buildAdaptiveCurriculumPrompt({
        goal,
        profile,
        preferences: {
          learning_formats: preferences?.learning_formats ?? ["reading", "hands_on_projects"],
          learning_pace: preferences?.learning_pace ?? "balanced",
          weekly_minutes: preferences?.weekly_minutes ?? goal.weekly_minutes,
          language_code: preferences?.language_code ?? "en",
          preferred_days: preferences?.preferred_days ?? [],
        },
        domain,
        startDay,
        endDay,
        previousSummary,
      });

      let batch: GeneratedDay[] | undefined;
      let lastError: unknown;
      for (let attempt = 0; attempt < 2 && !batch; attempt += 1) {
        try {
          const generated = await this.ai.generateForLearning(req, prompt, {
            jsonMode: true,
            preferFallback: attempt === 1,
            maxOutputTokens: attempt === 0 ? 1800 : 2200,
          });
          batch = this.parseCurriculumBatch(generated.answer, startDay, endDay);
        } catch (error) {
          lastError = error;
          this.logger.warn(`Curriculum batch ${startDay}-${endDay} attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : "unknown error"}`);
          if (attempt === 0) {
            // Brief pause before trying fallback provider on attempt 2
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }
      }
      if (!batch) {
        this.logger.warn(`Curriculum batch ${startDay}-${endDay} stopped: ${lastError instanceof Error ? lastError.name : "unknown error"}`);
        if (days.length > 0) {
          try {
            let partialPath = existing;
            if (!partialPath) {
              const partialTitle = `${goal.title.trim()} — 45-day learning path`;
              const partialDesc = `A personalized 45-day learning plan for ${goal.title}, generated from your onboarding profile, preferences, current level and desired outcome.`;
              const created = await db.from("learning_paths").insert({
                user_id: userId, goal_id: goal.id, title: partialTitle,
                description: partialDesc, status: "in_progress",
              }).select("*").single();
              if (created.error || !created.data) throw new Error("Unable to save partial learning path.");
              partialPath = created.data;
            }
            const partialItems = days.flatMap(day => day.tasks.map((task, index) => ({
              user_id: userId, path_id: partialPath.id,
              title: `Day ${day.day}: ${task.title}`,
              description: `${day.title} — ${day.focus}. ${task.description}`,
              item_type: task.item_type, position: (day.day - 1) * TASKS_PER_DAY + index, status: "not_started",
            })));
            const savedPartial = await db.from("learning_path_items").insert(partialItems);
            if (savedPartial.error) throw new Error("Unable to save partial curriculum tasks.");
          } catch (persistErr) {
            this.logger.warn(`Failed to persist partial batches: ${persistErr instanceof Error ? persistErr.message : "unknown error"}`);
          }
        }
        throw new ServiceUnavailableException({
          code: "CURRICULUM_GENERATION_TEMPORARILY_UNAVAILABLE",
          message: "Your learning plan could not be generated right now because the AI service is busy. Your profile and goals are saved. Please try again shortly.",
        });
      }
      days.push(...batch);
    }

    const curriculum: GeneratedCurriculum = {
      title: `${goal.title.trim()} — 45-day learning path`,
      description: `A personalized 45-day learning plan for ${goal.title}, generated from your onboarding profile, preferences, current level and desired outcome.`,
      days,
    };

    let path = existing;
    if (!path) {
      const { data: createdPath, error: pathError } = await db.from("learning_paths").insert({
        user_id: userId, goal_id: goal.id, title: curriculum.title,
        description: curriculum.description, status: "in_progress",
      }).select("*").single();
      if (pathError || !createdPath) throw new InternalServerErrorException("Unable to save the generated learning path.");
      path = createdPath;
    }

    const newItems = curriculum.days.flatMap(day => day.tasks.map((task, index) => ({
      user_id: userId, path_id: path.id,
      title: `Day ${day.day}: ${task.title}`,
      description: `${day.title} — ${day.focus}. ${task.description}`,
      item_type: task.item_type, position: (day.day - 1) * TASKS_PER_DAY + index, status: "not_started",
    })));
    let savedNewItems: any[] = [];
    if (newItems.length) {
      const { data, error: itemError } = await db.from("learning_path_items").insert(newItems).select("*");
      if (itemError || !data || data.length !== newItems.length) {
        throw new InternalServerErrorException("The generated curriculum could not be saved completely. Existing learning progress was preserved.");
      }
      savedNewItems = data;
    }

    const allItems = [...existingItems, ...savedNewItems].sort((a, b) => a.position - b.position);
    if (allItems.length !== TOTAL_DAYS * TASKS_PER_DAY) {
      throw new InternalServerErrorException("The roadmap is still incomplete. Saved tasks were preserved for a safe retry.");
    }
    if (existing) {
      const activated = await db.from("learning_paths").update({ status: "active" })
        .eq("id", path.id).eq("user_id", userId).select("*").single();
      if (activated.error || !activated.data) {
        throw new InternalServerErrorException("The completed roadmap could not be activated. Saved tasks were preserved.");
      }
      path = activated.data;
    } else {
      path = { ...path, status: "active" };
    }
    return {
      ...path,
      items: allItems,
      generation: { batches: TOTAL_DAYS / DAYS_PER_BATCH, days: TOTAL_DAYS, tasks: TOTAL_DAYS * TASKS_PER_DAY, resumed: resumeStartDay > 1 },
    };
  }

  parseCurriculumBatch(raw: string, startDay: number, endDay: number): GeneratedDay[] {
    const cleaned = this.extractJson(raw);
    let value: unknown;
    try {
      value = JSON.parse(cleaned);
    } catch {
      try {
        const repaired = this.repairJson(cleaned);
        value = JSON.parse(repaired);
      } catch {
        throw new BadRequestException("The AI provider returned incomplete or invalid curriculum JSON.");
      }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("The AI provider returned an invalid curriculum batch.");
    }
    const days = (value as { days?: unknown }).days;
    if (!Array.isArray(days) || days.length !== endDay - startDay + 1) {
      throw new BadRequestException(`The AI curriculum batch must contain exactly days ${startDay}-${endDay}.`);
    }
    days.forEach((candidate, index) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        throw new BadRequestException(`AI curriculum day ${startDay + index} is invalid.`);
      }
      const day = candidate as GeneratedDay;
      if (day.day !== startDay + index || typeof day.title !== "string" || !day.title.trim() || day.title.length > 120 ||
          typeof day.focus !== "string" || !day.focus.trim() || day.focus.length > 300 || !Array.isArray(day.tasks) || day.tasks.length !== TASKS_PER_DAY) {
        throw new BadRequestException(`AI curriculum day ${startDay + index} is incomplete.`);
      }
      const allowedTypes = ["lesson", "exercise", "resource", "project"];
      const seenTypes = new Set<string>();
      day.tasks.forEach(task => {
        if (!task || typeof task !== "object" || typeof task.title !== "string" || !task.title.trim() ||
            typeof task.description !== "string" || !task.description.trim() || task.title.length > 160 || task.description.length > 700 ||
            !allowedTypes.includes(task.item_type) || seenTypes.has(task.item_type)) {
          throw new BadRequestException("AI curriculum day contains an invalid or duplicate task type.");
        }
        seenTypes.add(task.item_type);
      });
      if (seenTypes.size !== TASKS_PER_DAY) {
        throw new BadRequestException("Each curriculum day must contain one lesson, exercise, resource and project.");
      }
    });
    return days as GeneratedDay[];
  }

  private repairJson(jsonStr: string): string {
    let repaired = jsonStr.trim();
    repaired = repaired.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    repaired = repaired.replace(/,\s*([}\]])/g, "$1");
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      repaired += "]".repeat(openBrackets - closeBrackets);
    }
    if (openBraces > closeBraces) {
      repaired += "}".repeat(openBraces - closeBraces);
    }
    return repaired;
  }

  private extractJson(raw: string): string {
    const text = raw.trim().replace(/^\uFEFF/, "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const start = text.indexOf("{");
    if (start < 0) return text;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) return text.slice(start, index + 1);
      }
    }
    return text.slice(start);
  }
}
