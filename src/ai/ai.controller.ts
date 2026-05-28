import { Controller, Post, Body, NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiRecommendRequestDto } from './dto/ai-recommend-request.dto';
import { AiChatRequestDto } from './dto/ai-chat-request.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  // POST /ai/recommend
  @Post('recommend')
  recommend(@Body() dto: AiRecommendRequestDto) {
    return this.aiService.getRecommendations(
      dto.purchaseHistory || [],
      dto.currentBasket || [],
      dto.nearbyDiscounts || [],
    );
  }

  // POST /ai/chat
  @Post('chat')
  async chat(@Body() dto: AiChatRequestDto) {
    const { userId, message, currentBasket = [] } = dto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: { include: { items: { include: { product: true } } } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const purchaseHistory = user.orders.flatMap((o) =>
      o.items.map((i) => i.product.name),
    );

    const now = new Date();
    const activeDiscounts = await this.prisma.discount.findMany({
      where: { startsAt: { lte: now }, endsAt: { gte: now } },
      include: { product: true, store: true },
    });

    const nearbyDiscounts = activeDiscounts.map(
      (d) => `[ID: ${d.product.id}] ${d.product.name} (${d.product.category}) ${d.discountPercent}% off at ${d.store.name}`,
    );

    const basketProducts = currentBasket.length
      ? await this.prisma.product.findMany({
          where: { id: { in: currentBasket } },
        })
      : [];
    const basketNames = basketProducts.map((p) => p.name);

    const result = await this.aiService.chat(
      userId,
      message,
      purchaseHistory,
      basketNames,
      nearbyDiscounts,
    );

    const suggestedProducts = result.suggestedProductIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: result.suggestedProductIds } },
        })
      : [];

    let responseWithTotal = result.response;
    if (suggestedProducts.length > 0) {
      const total = suggestedProducts.reduce((sum, p) => sum + p.price, 0);
      responseWithTotal += `\n\n💰 Эдгээр барааны нийт үнэ: ${total} ₮. Танд өөр авах зүйл байна уу?`;
    }

    return {
      response: responseWithTotal,
      suggestedProducts,
    };
  }
}
