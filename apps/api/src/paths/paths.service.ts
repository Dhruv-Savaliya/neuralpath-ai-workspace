import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import type { BootstrapPathDto } from "./dto/bootstrap-path.dto";
import { AiService } from "../ai/ai.service";

type GeneratedTask = { title: string; description: string; item_type: "lesson" | "exercise" | "resource" | "project" };
type GeneratedDay = { day: number; title: string; focus: string; tasks: GeneratedTask[] };
type GeneratedCurriculum = { title: string; description: string; days: GeneratedDay[] };

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
    // Keep the legacy hardcoded roadmap and its progress intact, but never present it as newly AI-generated.
    if (existing?.id && existing.title === "45-day AI engineering roadmap") {
      const { error: archiveError } = await db.from("learning_paths").update({ status: "archived" }).eq("id", existing.id).eq("user_id", userId);
      if (archiveError) throw new InternalServerErrorException("Unable to preserve and archive the legacy roadmap.");
    }

    const prompt = [
      "Create a high-quality personalized 45-day learning curriculum as strict JSON.",
      "Return only JSON matching: {title:string,description:string,days:[{day:number,title:string,focus:string,tasks:[{title:string,description:string,item_type:'lesson'|'exercise'|'resource'|'project'}]}]}.",
      "Requirements: exactly 45 sequential days, exactly 4 meaningful distinct tasks per day, practical progression from learner's current level to desired outcome, realistic workload, no generic repeated filler, specific deliverables and hands-on work. Resources must be described by name/topic in task descriptions; do not invent URLs.",
      "Personalize every day and task to the goal category and learner profile. Do not assume AI engineering unless the goal asks for it.",
      "LEARNER CONTEXT:",
      JSON.stringify({
        goal: { title: goal.title, category: goal.category, desiredOutcome: goal.desired_outcome, currentLevel: goal.current_level, targetDate: goal.target_date, weeklyMinutes: goal.weekly_minutes },
        profile: { profession: profile?.profession, experienceLevel: profile?.experience_level, interests: profile?.interests },
      }),
    ].join("\n");
    const generated = await this.ai.generateForLearning(req, prompt);
    const curriculum = this.parseCurriculum(generated.answer);

    const { data: path, error: pathError } = await db.from("learning_paths").insert({
      user_id: userId, goal_id: goal.id, title: curriculum.title,
      description: curriculum.description, status: "active",
    }).select("*").single();
    if (pathError || !path) throw new InternalServerErrorException("Unable to save the generated learning path.");

    const items = curriculum.days.flatMap(day => day.tasks.map((task, index) => ({
      user_id: userId, path_id: path.id,
      title: `Day ${day.day}: ${task.title}`,
      description: `${day.title} — ${day.focus}. ${task.description}`,
      item_type: task.item_type, position: (day.day - 1) * 4 + index, status: "not_started",
    })));
    const { data: savedItems, error: itemError } = await db.from("learning_path_items").insert(items).select("*");
    if (itemError || !savedItems || savedItems.length !== 180) {
      await db.from("learning_path_items").delete().eq("path_id", path.id).eq("user_id", userId);
      await db.from("learning_paths").delete().eq("id", path.id).eq("user_id", userId);
      throw new InternalServerErrorException("The generated curriculum could not be saved completely. No partial roadmap was kept.");
    }
    return { ...path, items: savedItems.sort((a,b) => a.position-b.position), generation: { provider: generated.provider, model: generated.model } };
  }

  private parseCurriculum(raw: string): GeneratedCurriculum {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    let value: unknown;
    try { value = JSON.parse(cleaned); }
    catch { throw new BadRequestException("The AI provider returned invalid curriculum JSON. Please retry generation."); }
    if (!value || typeof value !== "object") throw new BadRequestException("The AI provider returned an invalid curriculum.");
    const curriculum = value as GeneratedCurriculum;
    if (typeof curriculum.title !== "string" || !curriculum.title.trim() ||
        typeof curriculum.description !== "string" || !Array.isArray(curriculum.days) || curriculum.days.length !== 45) {
      throw new BadRequestException("The AI curriculum must contain a title, description and exactly 45 days.");
    }
    curriculum.days.forEach((day, index) => {
      if (day.day !== index + 1 || typeof day.title !== "string" || typeof day.focus !== "string" ||
          !Array.isArray(day.tasks) || day.tasks.length !== 4) {
        throw new BadRequestException(`AI curriculum day ${index + 1} is incomplete.`);
      }
      day.tasks.forEach(task => {
        if (!task.title?.trim() || !task.description?.trim() ||
            !["lesson", "exercise", "resource", "project"].includes(task.item_type)) {
          throw new BadRequestException(`AI curriculum day ${index + 1} contains an invalid task.`);
        }
      });
    });
    return curriculum;
  }
}
