import { Controller, Get, Post, Body, Query, ParseIntPipe } from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  // POST /discounts
  @Post()
  create(@Body() dto: CreateDiscountDto) {
    return this.discountsService.create(dto);
  }

  // GET /discounts
  @Get()
  findAll() {
    return this.discountsService.findAll();
  }

  // GET /discounts/active
  @Get('active')
  findActive(
    @Query('storeId') storeId?: string,
    @Query('productId') productId?: string,
  ) {
    if (storeId) return this.discountsService.findActiveByStore(parseInt(storeId));
    if (productId) return this.discountsService.findActiveByProduct(parseInt(productId));
    return this.discountsService.findActive();
  }
}
