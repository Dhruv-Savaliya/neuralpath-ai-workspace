import { IsString, Matches } from "class-validator";

export class AcceptRecommendationDto {
  @IsString()
  @Matches(/^(task:[0-9a-f-]{36}|pace:weekly-minutes)$/i)
  candidateId!: string;
}
