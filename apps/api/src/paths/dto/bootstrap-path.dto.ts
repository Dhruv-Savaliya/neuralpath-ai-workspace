import { IsUUID } from "class-validator";
export class BootstrapPathDto {
  @IsUUID()
  goal_id!: string;
}
