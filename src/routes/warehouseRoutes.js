import { Router } from 'express';
import {
  getWarehouses,
  getWarehouseGrid,
  getAvailableRacks,
} from '../controllers/warehouseController.js';
import { authenticateJWT, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// All warehouse routes require a valid JWT
router.use(authenticateJWT);

// List warehouses — CLIENT is explicitly blocked
router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF'),
  getWarehouses
);

// !! MUST be registered BEFORE /:id/grid — 'racks' would otherwise match :id !!
// Available racks — CLIENT and SUPER_ADMIN (different scopes handled in controller)
router.get(
  '/racks/available',
  authorizeRoles('SUPER_ADMIN', 'CLIENT'),
  getAvailableRacks
);

// Deep grid fetch — SUPER_ADMIN or warehouse personnel only
router.get(
  '/:id/grid',
  authorizeRoles('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF'),
  getWarehouseGrid
);

export default router;
