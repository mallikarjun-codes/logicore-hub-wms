import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.get('/', async (req: Request, res: Response) => {
  try {
    // Test DB Connection by fetching the warehouse count
    const warehouseCount = await prisma.warehouse.count();
    res.json({
      success: true,
      message: 'WareMind AI API is running.',
      database: 'Connected to PostgreSQL',
      data: {
        warehouses: warehouseCount
      }
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed.',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
