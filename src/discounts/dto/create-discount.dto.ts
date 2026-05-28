import { IsInt, IsNumber, IsString, IsISO8601, Min } from 'class-validator';

export class CreateDiscountDto {
  @IsInt()
  productId: number;

  @IsInt()
  storeId: number;

  @IsNumber()
  @Min(0)
  discountedPrice: number;

  @IsNumber()
  @Min(0)
  discountPercent: number;

  @IsISO8601()
  startsAt: string;

  @IsISO8601()
  endsAt: string;
}
