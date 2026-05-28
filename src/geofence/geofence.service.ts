import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StoresService } from '../stores/stores.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { calculateDistance } from '../common/utils/haversine.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeofenceService {
  private readonly logger = new Logger(GeofenceService.name);

  constructor(
    private prisma: PrismaService,
    private storesService: StoresService,
    private recommendationsService: RecommendationsService,
    private notificationsService: NotificationsService,
    private config: ConfigService,
  ) {}

  // Runs every 2 minutes automatically
  @Cron('*/2 * * * *')
  async runGeofenceCheck() {
    this.logger.log('⏰ Running scheduled geofence check...');

    const usersWithLocation = await this.prisma.user.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        fcmToken: { not: null },
      },
    });

    for (const user of usersWithLocation) {
      await this.checkUserLocation(user.id, user.latitude, user.longitude);
    }
  }

  // Also callable manually via API for real-time location updates
  async checkUserLocation(userId: number, lat: number, lon: number) {
    const radius = Number(this.config.get('GEOFENCE_RADIUS_METERS')) || 500;

    const nearbyStores = await this.storesService.findNearby(lat, lon, radius);

    if (nearbyStores.length === 0) {
      this.logger.debug(`User ${userId} — no stores within ${radius}m`);
      return { userId, nearbyStores: [], notifications: [] };
    }

    this.logger.log(
      `User ${userId} is near ${nearbyStores.length} store(s): ${nearbyStores.map((s) => s.name).join(', ')}`,
    );

    // Check for active discounts in nearby stores
    const storesWithDiscounts = nearbyStores.filter((s) => s.discounts.length > 0);

    if (storesWithDiscounts.length === 0) {
      return { userId, nearbyStores, notifications: [] };
    }

    // Generate recommendations
    const recommendations = await this.recommendationsService.generate({
      userId,
      latitude: lat,
      longitude: lon,
      currentBasket: [],
    });

    const notifications = [];

    // Send notification for top recommendations
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User ${userId} not found during location check`);
      return { userId, nearbyStores, recommendations, notifications: [] };
    }

    const threshold = Number(this.config.get('RECOMMENDATION_SCORE_THRESHOLD')) || 0.3;

    const topRecs = recommendations.scoredProducts
      .filter((r) => r.score >= threshold)
      .slice(0, 3);

    for (const rec of topRecs) {
      if (rec.discount && user.fcmToken) {
        const result = await this.notificationsService.send({
          fcmToken: user.fcmToken,
          title: `${rec.product.name} — Nearby Discount! 🛒`,
          body: `${rec.product.name} is ${rec.discount.discountPercent}% off at ${rec.discount.store.name}, ${rec.storeDistance}m away.`,
          data: {
            storeId: String(rec.discount.storeId),
            productId: String(rec.product.id),
            discountPercent: String(rec.discount.discountPercent),
          },
        });
        notifications.push({ product: rec.product.name, ...result });
      }
    }

    return { userId, nearbyStores, recommendations, notifications };
  }
}
