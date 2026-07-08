import { Router } from 'express';
import {
  createDispatchRequest,
  approveDispatchRequest,
  finalizeDispatchRequest,
} from '../controllers/dispatchController.js';
import { authenticateJWT, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Apply authentication to all dispatch routes
router.use(authenticateJWT);

router.post('/', authorizeRoles('CLIENT'), createDispatchRequest);
router.put('/:id/approve', authorizeRoles('WAREHOUSE_MANAGER', 'SUPER_ADMIN'), approveDispatchRequest);
router.put('/:id/dispatch', authorizeRoles('WAREHOUSE_STAFF', 'WAREHOUSE_MANAGER', 'SUPER_ADMIN'), finalizeDispatchRequest);

export default router;
