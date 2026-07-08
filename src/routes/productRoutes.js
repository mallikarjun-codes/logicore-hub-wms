import { Router } from 'express';
import {
  createProduct,
  getProducts,
  getProductById,
  deleteProduct,
} from '../controllers/productController.js';
import { authenticateJWT } from '../middlewares/authMiddleware.js';

const router = Router();

// All product routes require a valid JWT
router.use(authenticateJWT);

router.post('/', createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.delete('/:id', deleteProduct);

export default router;
