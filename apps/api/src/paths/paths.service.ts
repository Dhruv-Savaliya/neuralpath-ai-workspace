import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import type { BootstrapPathDto } from "./dto/bootstrap-path.dto";
import { AiService } from "../ai/ai.service";

type GeneratedTask = { title: string; description: string; item_type: "lesson" | "exercise" | "resource" | "project" };
type GeneratedDay = { day: number; title: string; focus: string; tasks: GeneratedTask[] };
type GeneratedCurriculum = { title: string; description: string; days: GeneratedDay[] };

const DAYS_PER_BATCH = 5;
const TOTAL_DAYS = 45;
const TASKS_PER_DAY = 4;

@Injectable()
export class PathsService {
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
      .select("display_name,profession,experience_level,interests")
      .eq("id", userId).maybeSingle();
    if (profileError) throw new InternalServerErrorException("Unable to load learner profile.");

    const { data: existing, error: existingError } = await db.from("learning_paths")
      .select("*,items:learning_path_items(*)")
      .eq("user_id", userId).eq("goal_id", goal.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existingError) throw new InternalServerErrorException("Unable to load the learning path.");
    if (existing?.items?.length && existing.title !== "45-day AI engineering roadmap") {
      return { ...existing, items: [...existing.items].sort((a,b) => a.position-b.position) };
    }
    // Preserve legacy progress by archiving the known placeholder roadmap before generating its replacement.
    if (existing?.id && existing.title === "45-day AI engineering roadmap") {
      const { error: archiveError } = await db.from("learning_paths").update({ status: "archived" }).eq("id", existing.id).eq("user_id", userId);
      if (archiveError) throw new InternalServerErrorException("Unable to preserve and archive the legacy roadmap.");
    }

    const learnerContext = JSON.stringify({
      goal: { title: goal.title, category: goal.category, desiredOutcome: goal.desired_outcome, currentLevel: goal.current_level, targetDate: goal.target_date, weeklyMinutes: goal.weekly_minutes },
      profile: { profession: profile?.profession, experienceLevel: profile?.experience_level, interests: profile?.interests },
    });
    const days: GeneratedDay[] = [];

    // Small independently validated batches keep responses well below provider output limits.
    for (let startDay = 1; startDay <= TOTAL_DAYS; startDay += DAYS_PER_BATCH) {
      const endDay = Math.min(startDay + DAYS_PER_BATCH - 1, TOTAL_DAYS);
      const prompt = [
        "Create one batch of a personalized 45-day learning curriculum as strict JSON.",
        "Return ONLY a JSON object matching {days:[{day:number,title:string,focus:string,tasks:[{title:string,description:string,item_type:'lesson'|'exercise'|'resource'|'project'}]}]}.",
        `Generate exactly days ${startDay} through ${endDay}, inclusive, in sequential order. Return exactly ${endDay - startDay + 1} day objects and exactly 4 distinct tasks per day.`,
        "Every task must have a concise useful title, actionable description and valid item_type. Include practical work and tangible deliverables. Do not add markdown fences, commentary, extra keys or URLs.",
        "Ensure this batch continues a coherent progression from prior days without repeating generic filler.",
        "LEARNER CONTEXT:",
        learnerContext,
        "PREVIOUS BATCH SUMMARY:",
        days.length ? days.slice(-5).map(day => ({ day: day.day, title: day.title, focus: day.focus })).map(value => JSON.stringify(value)).join("\n") : "This is the first batch.",
      ].join("\n");

      let batch: GeneratedDay[] | undefined;
      let lastError: unknown;
      for (let attempt = 0; attempt < 2 && !batch; attempt += 1) {
        try {
          const generated = await this.ai.generateForLearning(req, prompt, { jsonMode: true, preferFallback: attempt === 1 });
          batch = this.parseCurriculumBatch(generated.answer, startDay, endDay);
        } catch (error) {
          lastError = error;
        }
      }
      if (!batch) {
        throw new ServiceUnavailableException(
          `Unable to generate a valid curriculum for days ${startDay}-${endDay}. ${lastError instanceof Error ? lastError.message : "Please retry generation."}`,
        );
      }
      days.push(...batch);
    }

    const curriculum: GeneratedCurriculum = {
      title: `${goal.title.trim()} — 45-day personalized learning path`,
      description: `A personalized 45-day learning plan for ${goal.title}, generated in validated batches and tailored to your current level and desired outcome.`,
      days,
    };

    const { data: path, error: pathError } = await db.from("learning_paths").insert({
      user_id: userId, goal_id: goal.id, title: curriculum.title,
      description: curriculum.description, status: "active",
    }).select("*").single();
    if (pathError || !path) throw new InternalServerErrorException("Unable to save the generated learning path.");

    const items = curriculum.days.flatMap(day => day.tasks.map((task, index) => ({
      user_id: userId, path_id: path.id,
      title: `Day ${day.day}: ${task.title}`,
      description: `${day.title} — ${day.focus}. ${task.description}`,
      item_type: task.item_type, position: (day.day - 1) * TASKS_PER_DAY + index, status: "not_started",
    })));
    const { data: savedItems, error: itemError } = await db.from("learning_path_items").insert(items).select("*");
    if (itemError || !savedItems || savedItems.length !== TOTAL_DAYS * TASKS_PER_DAY) {
      await db.from("learning_path_items").delete().eq("path_id", path.id).eq("user_id", userId);
      await db.from("learning_paths").delete().eq("id", path.id).eq("user_id", userId);
      throw new InternalServerErrorException("The generated curriculum could not be saved completely. No partial roadmap was kept.");
    }
    return {
      ...path,
      items: savedItems.sort((a,b) => a.position-b.position),
      generation: { batches: TOTAL_DAYS / DAYS_PER_BATCH, days: TOTAL_DAYS, tasks: TOTAL_DAYS * TASKS_PER_DAY },
    };
  }

  private parseCurriculumBatch(raw: string, startDay: number, endDay: number): GeneratedDay[] {
    const cleaned = this.extractJson(raw);
    let value: unknown;
    try { value = JSON.parse(cleaned); }
    catch { throw new BadRequestException("The AI provider returned incomplete or invalid curriculum JSON."); }
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
      if (day.day !== startDay + index || typeof day.title !== "string" || !day.title.trim() ||
          typeof day.focus !== "string" || !day.focus.trim() || !Array.isArray(day.tasks) || day.tasks.length !== TASKS_PER_DAY) {
        throw new BadRequestException(`AI curriculum day ${startDay + index} is incomplete.`);
      }
      day.tasks.forEach(task => {
        if (!task || typeof task !== "object" || typeof task.title !== "string" || !task.title.trim() ||
            typeof task.description !== "string" || !task.description.trim() ||
            !["lesson", "exercise", "resource", "project"].includes(task.item_type)) {
          throw new BadRequestException(`AI curriculum day ${startDay + index} contains an invalid task.`);
        }
      });
    });
    return days as GeneratedDay[];
  }

  private extractJson(raw: string): string {
    const text = raw.trim().replace(/^\uFEFF/, "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
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
