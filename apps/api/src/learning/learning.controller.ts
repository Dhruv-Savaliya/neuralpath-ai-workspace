import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { LearningService } from "./learning.service";

@Controller("learning")
@UseGuards(SupabaseAuthGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get("insights")
  getInsights(@Req() req: AuthenticatedRequest) {
    return this.learning.getInsights(req);
  }
}
