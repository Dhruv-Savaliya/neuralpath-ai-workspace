import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class ChatDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  question!: string;

  @IsOptional()
  @IsUUID()
  conversation_id?: string;
}
