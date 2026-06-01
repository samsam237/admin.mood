import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin "${username}" already exists — skipping seed`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.admin.create({ data: { username, passwordHash } });
  console.log(`Admin "${username}" created`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
