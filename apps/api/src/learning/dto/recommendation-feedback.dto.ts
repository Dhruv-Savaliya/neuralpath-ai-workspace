import { IsIn } from "class-validator";

export class RecommendationFeedbackDto {
  @IsIn(["helpful", "dismissed"])
  feedback!: "helpful" | "dismissed";
}
