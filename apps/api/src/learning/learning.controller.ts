import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { AcceptRecommendationDto } from "./dto/accept-recommendation.dto";
import { RecommendationFeedbackDto } from "./dto/recommendation-feedback.dto";
import { LearningService } from "./learning.service";

@Controller("learning")
@UseGuards(SupabaseAuthGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get("insights")
  getInsights(@Req() req: AuthenticatedRequest) {
    return this.learning.getInsights(req);
  }

  @Get("recommendations")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  getRecommendations(@Req() req: AuthenticatedRequest) {
    return this.learning.getRecommendations(req);
  }

  @Post("recommendations/:id/feedback")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  feedback(
    @Req() req: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: RecommendationFeedbackDto,
  ) {
    return this.learning.recordFeedback(req, id, dto);
  }

  @Post("recommendations/:id/accept")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  accept(
    @Req() req: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AcceptRecommendationDto,
  ) {
    return this.learning.acceptRecommendation(req, id, dto);
  }
}
