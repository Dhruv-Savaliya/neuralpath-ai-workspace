import { Transform } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from "class-validator";

const levels = ["beginner", "some_experience", "intermediate", "advanced"];

export class CreateGoalDto {
  @Transform(({ obj, key }) => typeof obj[key] === "string" ? obj[key].trim() : obj[key])
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(60)
  category?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  desired_outcome?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(levels)
  current_level?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  target_date?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(15)
  @Max(3000)
  weekly_minutes?: number;
}
