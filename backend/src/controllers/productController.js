import prisma from '../config/prisma.js';

/**
 * POST /api/products
 * Creates a product in the catalog.
 * - CLIENT: companyId is bound from req.user.companyId automatically.
 * - SUPER_ADMIN: companyId must be provided explicitly in the body.
 */
export const createProduct = async (req, res) => {
  try {
    const { role, companyId: userCompanyId } = req.user;
    const {
      sku,
      name,
      category,
      weight,
      dimensions,
      isHazardous,
      isTemperatureSensitive,
      companyId: bodyCompanyId,
    } = req.body;

    // Validate required fields
    if (!sku || !name || !category || weight === undefined || !dimensions) {
      res.status(400).json({
        success: false,
        message: 'sku, name, category, weight, and dimensions are all required.',
      });
      return;
    }

    // Resolve which company this product belongs to
    let resolvedCompanyId;
    if (role === 'CLIENT') {
      if (!userCompanyId) {
        res.status(400).json({ success: false, message: 'No company associated with your account.' });
        return;
      }
      resolvedCompanyId = userCompanyId;
    } else {
      // SUPER_ADMIN must supply companyId explicitly
      if (!bodyCompanyId) {
        res.status(400).json({
          success: false,
          message: 'SUPER_ADMIN must provide a companyId in the request body.',
        });
        return;
      }
      // Verify the target company exists
      const company = await prisma.company.findUnique({ where: { id: bodyCompanyId } });
      if (!company) {
        res.status(404).json({
          success: false,
          message: `Company with ID '${bodyCompanyId}' not found.`,
        });
        return;
      }
      resolvedCompanyId = bodyCompanyId;
    }

    // Enforce unique SKU across the entire database
    const existingSku = await prisma.product.findUnique({ where: { sku } });
    if (existingSku) {
      res.status(400).json({
        success: false,
        message: `A product with SKU '${sku}' already exists.`,
      });
      return;
    }

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        category,
        weight: parseFloat(weight),
        dimensions,
        isHazardous: isHazardous ?? false,
        isTemperatureSensitive: isTemperatureSensitive ?? false,
        companyId: resolvedCompanyId,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: product,
    });
  } catch (error) {
    console.error('[PRODUCT] createProduct error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred while creating the product.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * GET /api/products
 * Multi-tenant product retrieval:
 * - CLIENT: products belonging to their companyId only.
 * - WAREHOUSE_MANAGER / WAREHOUSE_STAFF: products that have active inventory
 *   inside their assigned warehouse.
 * - SUPER_ADMIN: all products.
 */
export const getProducts = async (req, res) => {
  try {
    const { role, companyId, warehouseId } = req.user;

    let products;

    if (role === 'CLIENT') {
      if (!companyId) {
        res.status(400).json({ success: false, message: 'No company associated with your account.' });
        return;
      }
      products = await prisma.product.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          _count: { select: { inventories: true } },
        },
      });
    } else if (role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE_STAFF') {
      if (!warehouseId) {
        res.status(400).json({ success: false, message: 'No warehouse assigned to your account.' });
        return;
      }
      // Products that have at least one active inventory record in this warehouse
      products = await prisma.product.findMany({
        where: {
          inventories: {
            some: {
              warehouseId,
              status: { in: ['STORED', 'ALLOCATED'] },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          _count: { select: { inventories: true } },
        },
      });
    } else {
      // SUPER_ADMIN — all products
      products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          _count: { select: { inventories: true } },
        },
      });
    }

    res.status(200).json({ success: true, data: products, total: products.length });
  } catch (error) {
    console.error('[PRODUCT] getProducts error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred while fetching products.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * GET /api/products/:id
 * Retrieves a single product. CLIENT users can only fetch their own company's products.
 */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, companyId } = req.user;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { inventories: true } },
      },
    });

    if (!product) {
      res.status(404).json({ success: false, message: `Product with ID '${id}' not found.` });
      return;
    }

    // Tenant isolation: CLIENT can only read their own company's products
    if (role === 'CLIENT' && product.companyId !== companyId) {
      res.status(403).json({ success: false, message: 'Access forbidden. This product belongs to another company.' });
      return;
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error('[PRODUCT] getProductById error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * DELETE /api/products/:id
 * Deletes a product.
 * Blocked if there are active (STORED or ALLOCATED) Inventory records referencing it.
 * CLIENT users can only delete their own company's products.
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, companyId } = req.user;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      res.status(404).json({ success: false, message: `Product with ID '${id}' not found.` });
      return;
    }

    // Tenant isolation for CLIENT users
    if (role === 'CLIENT' && product.companyId !== companyId) {
      res.status(403).json({ success: false, message: 'Access forbidden. You can only delete your own company\'s products.' });
      return;
    }

    // Safety check: block if active inventory references this product
    const activeInventoryCount = await prisma.inventory.count({
      where: {
        productId: id,
        status: { in: ['STORED', 'ALLOCATED'] },
      },
    });

    if (activeInventoryCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete product '${product.name}' (SKU: ${product.sku}). It has ${activeInventoryCount} active inventory record(s). Dispatch or remove inventory first.`,
      });
      return;
    }

    await prisma.product.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: `Product '${product.name}' (SKU: ${product.sku}) was permanently deleted.`,
    });
  } catch (error) {
    console.error('[PRODUCT] deleteProduct error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred while deleting the product.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
