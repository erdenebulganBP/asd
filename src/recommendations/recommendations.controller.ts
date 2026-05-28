import { Controller, Post, Body } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { GenerateRecommendationsDto } from './dto/generate-recommendations.dto';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  // POST /recommendations/generate
  @Post('generate')
  generate(@Body() dto: GenerateRecommendationsDto) {
    return this.recommendationsService.generate(dto);
  }
}
