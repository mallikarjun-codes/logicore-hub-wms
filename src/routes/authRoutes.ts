import { Router } from 'express';
import { login, getMe } from '../controllers/authController';
import { authenticateJWT } from '../middlewares/authMiddleware';

const router = Router();

// POST /api/auth/login  – public
router.post('/login', login);

// GET /api/auth/me  – protected; requires a valid JWT
router.get('/me', authenticateJWT, getMe);

export default router;
