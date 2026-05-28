import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateLocationDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    return this.prisma.user.create({ data: dto });
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: { orders: { include: { items: { include: { product: true } } } } },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            items: { include: { product: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async updateLocation(id: number, dto: UpdateLocationDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);

    return this.prisma.user.update({
      where: { id },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        ...(dto.fcmToken && { fcmToken: dto.fcmToken }),
      },
    });
  }

  async getPurchaseHistory(userId: number) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flatten into product frequency map
    const frequencyMap: Record<number, { product: any; count: number }> = {};

    for (const order of orders) {
      for (const item of order.items) {
        if (!frequencyMap[item.productId]) {
          frequencyMap[item.productId] = { product: item.product, count: 0 };
        }
        frequencyMap[item.productId].count += item.quantity;
      }
    }

    return Object.values(frequencyMap).sort((a, b) => b.count - a.count);
  }
}
