import { Router } from 'express';
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
} from '../controllers/companyController';
import { authenticateJWT, authorizeRoles } from '../middlewares/authMiddleware';
import { Role } from '@prisma/client';

const router = Router();

// All company routes are protected: valid JWT + SUPER_ADMIN role required
router.use(authenticateJWT, authorizeRoles(Role.SUPER_ADMIN));

router.post('/', createCompany);
router.get('/', getAllCompanies);
router.get('/:id', getCompanyById);
router.put('/:id', updateCompany);
router.delete('/:id', deleteCompany);

export default router;
