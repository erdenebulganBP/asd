import { IsInt, IsNumber, IsArray, IsOptional } from 'class-validator';

export class GenerateRecommendationsDto {
  @IsInt()
  userId: number;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  currentBasket?: number[];
}
