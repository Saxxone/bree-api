import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required (see env.example)');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const defaultImg =
    process.env.DEFAULT_PROFILE_IMG ??
    'https://placehold.co/128x128/e2e8f0/64748b?text=User';

  const passwordPlain = process.env.SEED_PASSWORD ?? 'password';
  const hash = await bcrypt.hash(passwordPlain, 10);

  const admin = await prisma.user.upsert({
    where: { email: process.env.SEED_EMAIL ?? 'admin@example.com' },
    update: {
      img: defaultImg,
    },
    create: {
      email: process.env.SEED_EMAIL ?? 'admin@example.com',
      username: process.env.SEED_USERNAME ?? 'admin',
      name: 'Seed Admin',
      img: defaultImg,
      password: hash,
      verified: true,
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      username: 'demo',
      name: 'Demo User',
      img: defaultImg,
      password: hash,
      verified: false,
    },
  });

  console.log('Seeded users:', { admin: admin.email, demo: demo.email });
  console.log(
    'Default login (unless SEED_* env overrides): admin@example.com / password',
  );

  const coinPackages: Array<{
    id: string;
    name: string;
    coinsMinor: number;
    sortOrder: number;
    stripePriceId: string | null;
    appleProductId: string | null;
    googleProductId: string | null;
  }> = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Starter',
      coinsMinor: 500,
      sortOrder: 10,
      stripePriceId: process.env.SEED_STRIPE_PRICE_STARTER ?? null,
      appleProductId: process.env.SEED_APPLE_PRODUCT_STARTER ?? 'com.example.coins.starter',
      googleProductId: process.env.SEED_GOOGLE_SKU_STARTER ?? 'coins_starter',
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Popular',
      coinsMinor: 1200,
      sortOrder: 20,
      stripePriceId: process.env.SEED_STRIPE_PRICE_POPULAR ?? null,
      appleProductId: process.env.SEED_APPLE_PRODUCT_POPULAR ?? 'com.example.coins.popular',
      googleProductId: process.env.SEED_GOOGLE_SKU_POPULAR ?? 'coins_popular',
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      name: 'Pro',
      coinsMinor: 3000,
      sortOrder: 30,
      stripePriceId: process.env.SEED_STRIPE_PRICE_PRO ?? null,
      appleProductId: process.env.SEED_APPLE_PRODUCT_PRO ?? 'com.example.coins.pro',
      googleProductId: process.env.SEED_GOOGLE_SKU_PRO ?? 'coins_pro',
    },
  ];

  for (const p of coinPackages) {
    await prisma.coinPackage.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        name: p.name,
        coinsMinor: p.coinsMinor,
        sortOrder: p.sortOrder,
        stripePriceId: p.stripePriceId,
        appleProductId: p.appleProductId,
        googleProductId: p.googleProductId,
        active: true,
      },
      update: {
        name: p.name,
        coinsMinor: p.coinsMinor,
        sortOrder: p.sortOrder,
        stripePriceId: p.stripePriceId,
        appleProductId: p.appleProductId,
        googleProductId: p.googleProductId,
        active: true,
      },
    });
  }
  console.log('Seeded coin packages:', coinPackages.map((p) => p.name).join(', '));

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
