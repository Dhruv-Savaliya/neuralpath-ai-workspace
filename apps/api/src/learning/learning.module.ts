import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { AiModule } from "../ai/ai.module";
import { LearningController } from "./learning.controller";
import { LearningService } from "./learning.service";

@Module({
  imports: [AiModule],
  controllers: [LearningController],
  providers: [LearningService, SupabaseAuthGuard],
})
export class LearningModule {}
