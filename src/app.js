import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import warehouseRoutes from './routes/warehouseRoutes.js';
import productRoutes from './routes/productRoutes.js';
import storageRoutes from './routes/storageRoutes.js';
import dispatchRoutes from './routes/dispatchRoutes.js';

// dotenv.config() is intentionally NOT called here.
// It is called in src/index.js (production) and in vitest.config.js (tests),
// so this file stays pure and importable by both contexts.

const app = express();

// ── Global Middlewares ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health Check Route ────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'WareMind AI API is running.',
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/products', productRoutes);
app.use('/api/storage/requests', storageRoutes);
app.use('/api/dispatch/requests', dispatchRoutes);

// ── 404 Catch-All ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

export default app;
