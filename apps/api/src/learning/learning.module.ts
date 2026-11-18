import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { LearningController } from "./learning.controller";
import { LearningService } from "./learning.service";

@Module({
  controllers: [LearningController],
  providers: [LearningService, SupabaseAuthGuard],
})
export class LearningModule {}
