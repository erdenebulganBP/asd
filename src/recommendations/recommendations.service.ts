import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { calculateDistance, distanceScore } from '../common/utils/haversine.util';
import { GenerateRecommendationsDto } from './dto/generate-recommendations.dto';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private config: ConfigService,
  ) {}

  async generate(dto: GenerateRecommendationsDto) {
    const { userId, latitude, longitude, currentBasket = [] } = dto;
    const radius = Number(this.config.get('GEOFENCE_RADIUS_METERS')) || 500;

    // 1. Get user
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User #${userId} not found`);

    // 2. Get purchase history (product frequency)
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    const purchaseFrequency: Record<number, number> = {};
    const categoryFrequency: Record<string, number> = {};
    const historyNames: string[] = [];

    for (const order of orders) {
      for (const item of order.items) {
        purchaseFrequency[item.productId] =
          (purchaseFrequency[item.productId] || 0) + item.quantity;
        categoryFrequency[item.product.category] =
          (categoryFrequency[item.product.category] || 0) + item.quantity;
        if (!historyNames.includes(item.product.name)) {
          historyNames.push(item.product.name);
        }
      }
    }

    // Max values for normalization
    const maxPurchaseFreq = Math.max(...Object.values(purchaseFrequency), 1);
    const maxCategoryFreq = Math.max(...Object.values(categoryFrequency), 1);

    // 3. Get active discounts with store locations
    const now = new Date();
    const activeDiscounts = await this.prisma.discount.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: { product: true, store: true },
    });

    // Filter to nearby discounts
    const nearbyDiscounts = activeDiscounts
      .map((d) => ({
        ...d,
        storeDistance: Math.round(
          calculateDistance(latitude, longitude, d.store.latitude, d.store.longitude),
        ),
      }))
      .filter((d) => d.storeDistance <= radius);

    const discountNames = nearbyDiscounts.map(
      (d) => `[ID: ${d.product.id}] ${d.product.name} (${d.product.category}) ${d.discountPercent}% off at ${d.store.name}`,
    );

    // 4. Get basket product names
    const basketProducts = currentBasket.length > 0
      ? await this.prisma.product.findMany({ where: { id: { in: currentBasket } } })
      : [];
    const basketNames = basketProducts.map((p) => p.name);

    // 5. Score each discounted product
    const scoredProducts = nearbyDiscounts.map((discount) => {
      const productId = discount.productId;

      // Frequency score: how often user bought this product (0-1)
      const freqScore = (purchaseFrequency[productId] || 0) / maxPurchaseFreq;

      // Category affinity: how much user likes this category (0-1)
      const catScore =
        (categoryFrequency[discount.product.category] || 0) / maxCategoryFreq;

      // Discount score: bigger discount = higher score (0-1)
      const discScore = discount.discountPercent / 100;

      // Distance score: closer = higher (0-1)
      const distScore = distanceScore(discount.storeDistance, radius);

      // Weighted formula from spec
      const score =
        freqScore * 0.4 +
        discScore * 0.3 +
        distScore * 0.2 +
        catScore * 0.1;

      return {
        product: discount.product,
        discount: {
          ...discount,
          store: discount.store,
        },
        storeDistance: discount.storeDistance,
        score: Math.round(score * 100) / 100,
        breakdown: {
          purchaseFrequency: Math.round(freqScore * 100) / 100,
          discountScore: Math.round(discScore * 100) / 100,
          distanceScore: Math.round(distScore * 100) / 100,
          categoryAffinity: Math.round(catScore * 100) / 100,
        },
      };
    });

    // Sort by score descending
    scoredProducts.sort((a, b) => b.score - a.score);

    // 6. Call AI for enhanced reasons (non-blocking, graceful fallback)
    let aiRecommendations = { recommendedProducts: [] };
    try {
      aiRecommendations = await this.aiService.getRecommendations(
        historyNames,
        basketNames,
        discountNames,
      );
    } catch {
      this.logger.warn('AI recommendations unavailable, using rule-based only');
    }

    // 7. Merge AI reasons into scored products
    const aiReasonMap: Record<number, string> = {};
    for (const rec of aiRecommendations.recommendedProducts) {
      aiReasonMap[rec.productId] = rec.reason;
    }

    const finalProducts = scoredProducts.map((item) => ({
      ...item,
      aiReason: aiReasonMap[item.product.id] || null,
      reason:
        aiReasonMap[item.product.id] ||
        this.buildRuleBasedReason(item, purchaseFrequency),
    }));

    return {
      userId,
      location: { latitude, longitude },
      nearbyStoresCount: new Set(nearbyDiscounts.map((d) => d.storeId)).size,
      scoredProducts: finalProducts,
      aiEnhanced: aiRecommendations.recommendedProducts.length > 0,
    };
  }

  private buildRuleBasedReason(
    item: { product: any; discount: any; score: number; breakdown: any },
    purchaseFrequency: Record<number, number>,
  ): string {
    const freq = purchaseFrequency[item.product.id] || 0;
    const store = item.discount.store.name;
    const pct = item.discount.discountPercent;

    if (freq > 0) {
      return `You've bought ${item.product.name} before and it's currently ${pct}% off at ${store}.`;
    }
    if (item.breakdown.categoryAffinity > 0.5) {
      return `Based on your love of ${item.product.category}, ${item.product.name} is ${pct}% off nearby at ${store}.`;
    }
    return `${item.product.name} has a great ${pct}% discount at ${store} near you.`;
  }
}
