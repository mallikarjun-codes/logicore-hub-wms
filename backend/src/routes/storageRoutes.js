import { Router } from 'express';
import {
  createStorageRequest,
  approveStorageRequest,
  arriveStorageRequest,
  storeStorageRequest,
} from '../controllers/storageController.js';
import { authenticateJWT, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Apply authentication to all storage routes
router.use(authenticateJWT);

router.post('/', authorizeRoles('CLIENT'), createStorageRequest);
router.put('/:id/approve', authorizeRoles('WAREHOUSE_MANAGER', 'SUPER_ADMIN'), approveStorageRequest);
router.put('/:id/arrive', authorizeRoles('WAREHOUSE_STAFF', 'WAREHOUSE_MANAGER', 'SUPER_ADMIN'), arriveStorageRequest);
router.put('/:id/store', authorizeRoles('WAREHOUSE_STAFF', 'WAREHOUSE_MANAGER', 'SUPER_ADMIN'), storeStorageRequest);

export default router;
