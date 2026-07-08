import { Router } from 'express';
import {
  generateInvoice,
  getInvoices,
  payInvoice,
} from '../controllers/billingController.js';
import { authenticateJWT, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Apply authentication to all billing routes
router.use(authenticateJWT);

router.post('/invoices/generate', authorizeRoles('SUPER_ADMIN'), generateInvoice);
router.get('/invoices', authorizeRoles('CLIENT', 'SUPER_ADMIN'), getInvoices);
router.put('/invoices/:id/pay', authorizeRoles('CLIENT', 'SUPER_ADMIN'), payInvoice);

export default router;
