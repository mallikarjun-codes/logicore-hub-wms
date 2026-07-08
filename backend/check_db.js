import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const users = await p.user.findMany({
  where: { email: { contains: 'prod.test' } },
  select: { email: true, role: true },
});
console.log('prod.test users:', JSON.stringify(users, null, 2));
const companies = await p.company.findMany({
  where: { name: { contains: 'Product Test' } },
  select: { id: true, name: true, gstNumber: true },
});
console.log('Product Test companies:', JSON.stringify(companies, null, 2));
await p.$disconnect();
