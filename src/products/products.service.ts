import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  async findAll() {
    return this.prisma.product.findMany({
      include: { discounts: { include: { store: true } } },
    });
  }

  async findOne(id: number) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { discounts: { include: { store: true } } },
    });
  }

  async findByCategory(category: string) {
    return this.prisma.product.findMany({
      where: { category: { contains: category, mode: 'insensitive' } },
    });
  }
}
