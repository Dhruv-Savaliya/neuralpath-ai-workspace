import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
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

  @Get("knowledge")
  listKnowledge(@Req() req: AuthenticatedRequest) {
    return this.ai.listKnowledge(req);
  }

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

  @Get("conversations")
  listConversations(@Req() req: AuthenticatedRequest) {
    return this.ai.listConversations(req);
  }

  @Get("conversations/:conversationId")
  getConversation(@Req() req: AuthenticatedRequest, @Param("conversationId") conversationId: string) {
    return this.ai.getConversation(req, conversationId);
  }

  @Post("chat")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  chat(@Req() req: AuthenticatedRequest, @Body() dto: ChatDto) {
    return this.ai.chat(req, dto);
  }
}
