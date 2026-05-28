import { IsInt, IsString, IsArray, IsOptional } from 'class-validator';

export class AiChatRequestDto {
  @IsInt()
  userId: number;

  @IsString()
  message: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  currentBasket?: number[];
}
