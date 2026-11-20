import { Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards, Logger } from "@nestjs/common";
import type { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { AiService } from "./ai.service";
import { ChatDto } from "./dto/chat.dto";
import { IngestKnowledgeDto } from "./dto/ingest-knowledge.dto";

@Controller("ai")
@UseGuards(SupabaseAuthGuard)
export class AiController {
  private readonly logger = new Logger(AiController.name);

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


  @Post("chat/stream")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async streamChat(@Req() req: AuthenticatedRequest, @Body() dto: ChatDto, @Res() res: Response) {
    const abortController = new AbortController();
    res.on("close", () => { if (!res.writableEnded) abortController.abort(); });
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const send = (event: string, data: unknown) => {
      if (!res.writableEnded && !abortController.signal.aborted) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    send("ready", { status: "started" });
    try {
      const result = await this.ai.streamChat(req, dto, abortController.signal, token => send("token", { content: token }));
      send("done", result);
    } catch (error) {
      if (!abortController.signal.aborted) {
        this.logger.warn("AI Tutor stream ended before completion.");
        const message = error instanceof Error && /budget|quota/i.test(error.message)
          ? error.message : "NeuralPath could not complete this answer. Please try again.";
        send("error", { message });
      }
    } finally { if (!res.writableEnded) res.end(); }
  }

  @Post("chat")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  chat(@Req() req: AuthenticatedRequest, @Body() dto: ChatDto) {
    return this.ai.chat(req, dto);
  }
}
