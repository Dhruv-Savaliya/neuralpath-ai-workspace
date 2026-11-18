import { IsIn, IsString, Matches } from "class-validator";

export class RecommendationFeedbackDto {
  @IsIn(["helpful", "dismissed"])
  feedback!: "helpful" | "dismissed";

  @IsString()
  @Matches(/^(task:[0-9a-f-]{36}|pace:weekly-minutes)$/i)
  candidateId!: string;
}
