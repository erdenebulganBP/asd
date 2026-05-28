import { IsArray, IsString, IsOptional } from 'class-validator';

export class AiRecommendRequestDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  purchaseHistory?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentBasket?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nearbyDiscounts?: string[];
}
