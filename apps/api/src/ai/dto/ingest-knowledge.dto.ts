import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class IngestKnowledgeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(40)
  @MaxLength(50000)
  content!: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  source_url?: string;
}
