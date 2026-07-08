import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import companyRoutes from './routes/companyRoutes.js';

// dotenv.config() is intentionally NOT called here.
// It is called in src/index.ts (production) and in vitest.config.ts (tests),
// so this file stays pure and importable by both contexts.

const app = express();

// ── Global Middlewares ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health Check Route ────────────────────────────────────────────────────────
app.get('/', async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'WareMind AI API is running.',
  });
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

export default app;
