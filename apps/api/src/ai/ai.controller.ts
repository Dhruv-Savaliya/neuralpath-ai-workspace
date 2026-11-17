import { Body, Controller, Delete, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { AiService } from "./ai.service";
import { ChatDto } from "./dto/chat.dto";
import { IngestKnowledgeDto } from "./dto/ingest-knowledge.dto";

@Controller("ai")
@UseGuards(SupabaseAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("knowledge")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  ingest(@Req() req: AuthenticatedRequest, @Body() dto: IngestKnowledgeDto) {
    return this.ai.ingest(req, dto);
  }

  @Delete("knowledge/:sourceId")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  deleteKnowledge(@Req() req: AuthenticatedRequest, @Param("sourceId") sourceId: string) {
    return this.ai.deleteKnowledge(req, sourceId);
  }

  @Post("chat")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  chat(@Req() req: AuthenticatedRequest, @Body() dto: ChatDto) {
    return this.ai.chat(req, dto);
  }
}
