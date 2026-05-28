import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding expanded database...');

  // Users
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com', latitude: 47.9185, longitude: 106.9177, fcmToken: 'fcm_mock_token_123' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', latitude: 47.918, longitude: 106.916, fcmToken: 'fcm_mock_token_456' },
  ];

  for (const u of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: u });
  }

  // Products
  const products = [
    { id: 1, name: 'Coca-Cola 2L', category: 'Drinks', price: 4500 },
    { id: 2, name: 'Doritos Nacho', category: 'Snacks', price: 5200 },
    { id: 3, name: 'Shin Ramyun', category: 'Instant Food', price: 2500 },
    { id: 4, name: 'Pepsi 2L', category: 'Drinks', price: 4200 },
    { id: 5, name: 'Lays Classic', category: 'Snacks', price: 3800 },
    { id: 6, name: 'Tiger Beer 0.5L', category: 'Alcohol', price: 4800 },
    { id: 7, name: 'Sengur Beer 0.5L', category: 'Alcohol', price: 3500 },
    { id: 8, name: 'Red Bull 250ml', category: 'Drinks', price: 5500 },
    { id: 9, name: 'Bonaqua 0.5L', category: 'Drinks', price: 1200 },
    { id: 10, name: 'Pringles Original', category: 'Snacks', price: 8500 },
    { id: 11, name: 'Choco Pie (12pcs)', category: 'Snacks', price: 9200 },
    { id: 12, name: 'Jinro Soju', category: 'Alcohol', price: 6500 },
    { id: 13, name: 'Toilet Paper (12pcs)', category: 'Household', price: 15000 },
    { id: 14, name: 'Milk 1L (Suu)', category: 'Dairy', price: 4200 },
    { id: 15, name: 'Eggs (10pcs)', category: 'Dairy', price: 5500 },
    { id: 16, name: 'Chicken Wings 1kg', category: 'Meat', price: 18000 },
    { id: 17, name: 'Beef Meat 1kg', category: 'Meat', price: 22000 },
    { id: 18, name: 'Bread (Talkh)', category: 'Bakery', price: 2500 },
    { id: 19, name: 'Potato 1kg', category: 'Vegetables', price: 1800 },
    { id: 20, name: 'Onion 1kg', category: 'Vegetables', price: 1500 },
    { id: 21, name: 'Vodka (Chinggis) 0.75L', category: 'Alcohol', price: 28000 },
    { id: 22, name: 'Whiskey (Black Label) 0.75L', category: 'Alcohol', price: 85000 },
    { id: 23, name: 'Ice Cream (Movenpick)', category: 'Frozen', price: 12000 },
    { id: 24, name: 'Pizza (Frozen)', category: 'Frozen', price: 15000 },
    { id: 25, name: 'Juice (Cappy) 1L', category: 'Drinks', price: 4800 },
  ];

  for (const p of products) {
    await prisma.product.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  // Stores
  const stores = [
    { id: 1, name: 'Emart Ulaanbaatar', latitude: 47.919, longitude: 106.92, address: 'Peace Avenue' },
    { id: 2, name: 'CU Store Downtown', latitude: 47.917, longitude: 106.915, address: 'Seoul Street' },
    { id: 3, name: 'GS25 Central Square', latitude: 47.918, longitude: 106.918, address: 'Sukhbaatar Square' },
    { id: 4, name: 'Nomin Supermarket', latitude: 47.922, longitude: 106.910, address: 'State Department Store' },
  ];

  for (const s of stores) {
    await prisma.store.upsert({ where: { id: s.id }, update: {}, create: s });
  }

  // Discounts
  const now = new Date();
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const discounts = [
    { id: 1, productId: 1, storeId: 1, discountedPrice: 3500, discountPercent: 22, startsAt: now, endsAt: future },
    { id: 2, productId: 3, storeId: 2, discountedPrice: 1800, discountPercent: 28, startsAt: now, endsAt: future },
    { id: 3, productId: 6, storeId: 3, discountedPrice: 3800, discountPercent: 20, startsAt: now, endsAt: future },
    { id: 4, productId: 10, storeId: 4, discountedPrice: 6500, discountPercent: 23, startsAt: now, endsAt: future },
    { id: 5, productId: 12, storeId: 2, discountedPrice: 5500, discountPercent: 15, startsAt: now, endsAt: future },
    { id: 6, productId: 16, storeId: 1, discountedPrice: 14000, discountPercent: 22, startsAt: now, endsAt: future },
    { id: 7, productId: 21, storeId: 3, discountedPrice: 22000, discountPercent: 21, startsAt: now, endsAt: future },
    { id: 8, productId: 2, storeId: 4, discountedPrice: 4000, discountPercent: 23, startsAt: now, endsAt: future },
    { id: 9, productId: 5, storeId: 1, discountedPrice: 3000, discountPercent: 21, startsAt: now, endsAt: future },
    { id: 10, productId: 11, storeId: 3, discountedPrice: 7500, discountPercent: 18, startsAt: now, endsAt: future },
  ];

  for (const d of discounts) {
    await prisma.discount.upsert({ where: { id: d.id }, update: {}, create: d });
  }

  // Orders (History for John — day-by-day shopping pattern)
  const orders = [
    { id: 1, userId: 1, items: [{ id: 1, productId: 1, q: 3 }, { id: 2, productId: 2, q: 2 }] },
    { id: 2, userId: 1, items: [{ id: 3, productId: 1, q: 1 }, { id: 4, productId: 3, q: 4 }] },
    { id: 3, userId: 1, items: [{ id: 5, productId: 6, q: 6 }, { id: 6, productId: 10, q: 1 }] },
    { id: 4, userId: 1, items: [{ id: 7, productId: 5, q: 2 }, { id: 8, productId: 8, q: 1 }] },
    { id: 5, userId: 1, items: [{ id: 9, productId: 16, q: 1 }, { id: 10, productId: 12, q: 2 }] },
    { id: 6, userId: 1, items: [{ id: 11, productId: 11, q: 1 }, { id: 12, productId: 21, q: 1 }] },
    { id: 7, userId: 1, items: [{ id: 13, productId: 1, q: 2 }, { id: 14, productId: 6, q: 3 }] },
    { id: 8, userId: 2, items: [{ id: 15, productId: 14, q: 2 }, { id: 16, productId: 18, q: 1 }] },
    { id: 9, userId: 2, items: [{ id: 17, productId: 15, q: 1 }, { id: 18, productId: 19, q: 3 }] },
  ];

  for (const o of orders) {
    await prisma.order.upsert({ where: { id: o.id }, update: {}, create: { id: o.id, userId: o.userId } });
    for (const item of o.items) {
      await prisma.orderItem.upsert({ 
        where: { id: item.id }, 
        update: {}, 
        create: { id: item.id, orderId: o.id, productId: item.productId, quantity: item.q } 
      });
    }
  }

  console.log('✅ Expanded data seeded!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
