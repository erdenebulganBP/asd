import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // GET /stores
  @Get()
  findAll() {
    return this.storesService.findAll();
  }

  // GET /stores/nearby?lat=47.9185&lon=106.9177&radius=500
  @Get('nearby')
  findNearby(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
    @Query('radius') radius?: string,
  ) {
    return this.storesService.findNearby(
      parseFloat(lat),
      parseFloat(lon),
      radius ? parseFloat(radius) : undefined,
    );
  }

  // GET /stores/:id
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.findOne(id);
  }
}
