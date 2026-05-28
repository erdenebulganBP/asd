import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date(),
        db: 'connected',
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date(),
        db: 'disconnected',
        error: error.message,
      };
    }
  }
}
