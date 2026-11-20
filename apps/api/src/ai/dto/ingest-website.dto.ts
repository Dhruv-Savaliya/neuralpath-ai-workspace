import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class IngestWebsiteDto {
  @IsUrl({ protocols: ["https"], require_protocol: true, require_tld: true })
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;
}
