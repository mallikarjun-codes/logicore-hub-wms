import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import prisma from './config/prisma';

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`🚀  WareMind AI server started on http://localhost:${PORT}`);
  console.log(`📋  Registered routes:`);
  console.log(`      POST   /api/auth/login`);
  console.log(`      GET    /api/auth/me`);
  console.log(`      POST   /api/companies`);
  console.log(`      GET    /api/companies`);
  console.log(`      GET    /api/companies/:id`);
  console.log(`      PUT    /api/companies/:id`);
  console.log(`      DELETE /api/companies/:id`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
