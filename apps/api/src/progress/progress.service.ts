import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import type { SaveProgressDto } from "./dto/save-progress.dto";

@Injectable()
export class ProgressService {
  async save(req: AuthenticatedRequest, dto: SaveProgressDto) {
    const userId = req.user.id;
    const { data: item, error: itemError } = await req.supabase
      .from("learning_path_items")
      .select("id")
      .eq("id", dto.path_item_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (itemError) throw new InternalServerErrorException("Unable to verify the learning task.");
    if (!item) throw new NotFoundException("Learning task was not found.");

    const completed = dto.status === "completed";
    const { data, error } = await req.supabase
      .from("learning_progress")
      .upsert({
        user_id: userId,
        path_item_id: dto.path_item_id,
        status: dto.status,
        reflection: dto.reflection?.trim() ?? "",
        completed_at: completed ? new Date().toISOString() : null,
      }, { onConflict: "user_id,path_item_id" })
      .select("*")
      .single();
    if (error || !data) throw new InternalServerErrorException("Unable to save learning progress.");
    return data;
  }
}
