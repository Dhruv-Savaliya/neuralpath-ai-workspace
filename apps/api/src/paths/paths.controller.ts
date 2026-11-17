import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { BootstrapPathDto } from "./dto/bootstrap-path.dto";
import { PathsService } from "./paths.service";
@Controller("paths")
@UseGuards(SupabaseAuthGuard)
export class PathsController {
  constructor(private readonly service: PathsService) {}
  @Post("bootstrap") bootstrap(@Req() req: AuthenticatedRequest, @Body() dto: BootstrapPathDto) { return this.service.bootstrap(req,dto); }
}
