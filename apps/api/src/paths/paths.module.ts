import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { PathsController } from "./paths.controller";
import { PathsService } from "./paths.service";
@Module({controllers:[PathsController],providers:[PathsService,SupabaseAuthGuard]})
export class PathsModule {}
