import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { calculateDistance } from '../common/utils/haversine.util';

@Injectable()
export class StoresService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async findAll() {
    return this.prisma.store.findMany({
      include: { discounts: { include: { product: true } } },
    });
  }

  async findOne(id: number) {
    return this.prisma.store.findUnique({
      where: { id },
      include: { discounts: { include: { product: true } } },
    });
  }

  async findNearby(lat: number, lon: number, radiusMeters?: number) {
    const radius =
      radiusMeters || Number(this.config.get('GEOFENCE_RADIUS_METERS')) || 500;

    const stores = await this.prisma.store.findMany({
      include: {
        discounts: {
          where: {
            startsAt: { lte: new Date() },
            endsAt: { gte: new Date() },
          },
          include: { product: true },
        },
      },
    });

    const nearby = stores
      .map((store) => ({
        ...store,
        distanceMeters: Math.round(
          calculateDistance(lat, lon, store.latitude, store.longitude),
        ),
      }))
      .filter((store) => store.distanceMeters <= radius)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return nearby;
  }
}
