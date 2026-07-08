import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './config/prisma';
import authRoutes from './routes/authRoutes';
import companyRoutes from './routes/companyRoutes';

dotenv.config();

const app = express();

// ── Global Middlewares ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health Check Route ────────────────────────────────────────────────────────
app.get('/', async (req: Request, res: Response) => {
  try {
    const [warehouseCount, companyCount] = await Promise.all([
      prisma.warehouse.count(),
      prisma.company.count(),
    ]);

    res.status(200).json({
      success: true,
      message: 'WareMind AI API is running.',
      database: 'Connected ✅',
      stats: {
        warehouses: warehouseCount,
        companies: companyCount,
      },
    });
  } catch (error) {
    console.error('[HEALTH] Database connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);

// ── 404 Catch-All ─────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ── Server Startup ────────────────────────────────────────────────────────────
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
