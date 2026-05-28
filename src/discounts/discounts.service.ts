import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiscountDto } from './dto/create-discount.dto';

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDiscountDto) {
    return this.prisma.discount.create({
      data: {
        ...dto,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
      },
      include: { product: true, store: true },
    });
  }

  async findAll() {
    return this.prisma.discount.findMany({
      include: { product: true, store: true },
    });
  }

  async findActive() {
    const now = new Date();
    return this.prisma.discount.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: { product: true, store: true },
    });
  }

  async findActiveByStore(storeId: number) {
    const now = new Date();
    return this.prisma.discount.findMany({
      where: {
        storeId,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: { product: true, store: true },
    });
  }

  async findActiveByProduct(productId: number) {
    const now = new Date();
    return this.prisma.discount.findMany({
      where: {
        productId,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: { product: true, store: true },
    });
  }
}
