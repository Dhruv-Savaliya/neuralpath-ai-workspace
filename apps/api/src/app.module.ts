import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AiModule } from "./ai/ai.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { GoalsModule } from "./goals/goals.module";
import { HealthController } from "./health/health.controller";
import { PathsModule } from "./paths/paths.module";
import { ProfileModule } from "./profile/profile.module";
import { ProgressModule } from "./progress/progress.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env.local"],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    AiModule,
    DashboardModule,
    GoalsModule,
    ProfileModule,
    ProgressModule,
    PathsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
