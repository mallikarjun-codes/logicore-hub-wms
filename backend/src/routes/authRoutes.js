import { Router } from 'express';
import { login, register, getMe } from '../controllers/authController.js';
import { authenticateJWT } from '../middlewares/authMiddleware.js';

const router = Router();

// POST /api/auth/register  — public; creates a new user account
router.post('/register', register);

// POST /api/auth/login  — public
router.post('/login', login);

// GET /api/auth/me  — protected; requires a valid JWT
router.get('/me', authenticateJWT, getMe);

export default router;
