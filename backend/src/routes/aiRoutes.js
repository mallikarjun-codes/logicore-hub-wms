import { Router } from 'express';
import { askCopilot } from '../controllers/aiController.js';
import { authenticateJWT } from '../middlewares/authMiddleware.js';

const router = Router();

// Apply authentication to all AI routes
router.use(authenticateJWT);

router.post('/copilot', askCopilot);

export default router;
