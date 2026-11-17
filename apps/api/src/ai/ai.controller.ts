import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
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
  ingest(@Req() req: AuthenticatedRequest, @Body() dto: IngestKnowledgeDto) {
    return this.ai.ingest(req, dto);
  }

  @Post("chat")
  chat(@Req() req: AuthenticatedRequest, @Body() dto: ChatDto) {
    return this.ai.chat(req, dto);
  }
}
