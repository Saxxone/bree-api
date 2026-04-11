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

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
