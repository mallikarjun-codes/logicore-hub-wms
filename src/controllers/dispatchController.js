import prisma from '../config/prisma.js';

/**
 * POST /api/dispatch/requests
 * Creates a new dispatch request. 'CLIENT' role only.
 */
export const createDispatchRequest = async (req, res) => {
  try {
    const { role, companyId } = req.user;
    const { productId, quantity, warehouseId, requestedPallets } = req.body;

    if (!productId || quantity === undefined || !warehouseId) {
      return res.status(400).json({
        success: false,
        message: 'productId, quantity, and warehouseId are required.',
      });
    }

    if (role !== 'CLIENT') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Only CLIENT role can create dispatch requests.',
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'No company associated with your account.',
      });
    }

    const qty = parseInt(quantity, 10);
    if (qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0.',
      });
    }

    // Verify product exists and belongs to client's company
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${productId}' not found.`,
      });
    }

    if (product.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Product belongs to another company.',
      });
    }

    // Verify warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: `Warehouse with ID '${warehouseId}' not found.`,
      });
    }

    // Enforce Business Rule 5: Sum of available inventory ('STORED') for this product/company/warehouse must be >= qty
    const availableInventory = await prisma.inventory.aggregate({
      _sum: { quantity: true },
      where: {
        productId,
        companyId,
        warehouseId,
        status: 'STORED',
      },
    });

    const availableQty = availableInventory._sum.quantity || 0;

    if (qty > availableQty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient inventory. Requested: ${qty}, Available: ${availableQty}.`,
      });
    }

    const pallets = requestedPallets !== undefined ? parseInt(requestedPallets, 10) : 1;

    const dispatchRequest = await prisma.dispatchRequest.create({
      data: {
        status: 'PENDING',
        itemsDetails: { productId, quantity: qty, requestedPallets: pallets },
        companyId,
        warehouseId,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Dispatch request created successfully.',
      data: dispatchRequest,
    });
  } catch (error) {
    console.error('[DISPATCH] createDispatchRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * PUT /api/dispatch/requests/:id/approve
 * Approves a dispatch request. 'WAREHOUSE_MANAGER' or 'SUPER_ADMIN' only.
 */
export const approveDispatchRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, warehouseId } = req.user;

    const request = await prisma.dispatchRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: `Dispatch request with ID '${id}' not found.`,
      });
    }

    if (role === 'WAREHOUSE_MANAGER' && warehouseId !== request.warehouseId) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You can only approve requests for your assigned warehouse.',
      });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve dispatch request in '${request.status}' status. Only PENDING requests can be approved.`,
      });
    }

    const updated = await prisma.dispatchRequest.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    return res.status(200).json({
      success: true,
      message: 'Dispatch request approved successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('[DISPATCH] approveDispatchRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * PUT /api/dispatch/requests/:id/dispatch
 * Finalizes the dispatch request. Depletes quantity from inventory and decreases occupancy.
 */
export const finalizeDispatchRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, warehouseId } = req.user;

    const request = await prisma.dispatchRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: `Dispatch request with ID '${id}' not found.`,
      });
    }

    if (
      (role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE_STAFF') &&
      warehouseId !== request.warehouseId
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You can only dispatch requests for your assigned warehouse.',
      });
    }

    if (request.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: `Cannot dispatch request in '${request.status}' status. Only APPROVED requests can be dispatched.`,
      });
    }

    const details = request.itemsDetails;
    const productId = details.productId;
    const requestedQty = details.quantity;
    const requestedPallets = details.requestedPallets || 1;

    // Run transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch available STORED inventory records for this product, company, and warehouse
      const activeInventories = await tx.inventory.findMany({
        where: {
          productId,
          companyId: request.companyId,
          warehouseId: request.warehouseId,
          status: 'STORED',
        },
        orderBy: { createdAt: 'asc' },
      });

      const totalAvailable = activeInventories.reduce((acc, inv) => acc + inv.quantity, 0);

      // Re-verify quantity check under lock/transaction
      if (requestedQty > totalAvailable) {
        throw new Error('InsufficientInventory');
      }

      // 2. Deplete quantities from active inventory records
      let remainingToDeplete = requestedQty;
      for (const inventory of activeInventories) {
        if (remainingToDeplete <= 0) break;

        if (inventory.quantity <= remainingToDeplete) {
          remainingToDeplete -= inventory.quantity;
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              status: 'DISPATCHED',
              quantity: 0,
            },
          });
        } else {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: {
                decrement: remainingToDeplete,
              },
            },
          });
          remainingToDeplete = 0;
        }
      }

      // 3. Change status to DISPATCHED
      const updatedRequest = await tx.dispatchRequest.update({
        where: { id },
        data: { status: 'DISPATCHED' },
      });

      // 4. Decrement warehouse occupancy
      const warehouse = await tx.warehouse.findUnique({
        where: { id: request.warehouseId },
      });

      if (!warehouse) {
        throw new Error('WarehouseNotFound');
      }

      const newOccupancy = Math.max(0, warehouse.currentOccupancyPallets - requestedPallets);

      const updatedWarehouse = await tx.warehouse.update({
        where: { id: request.warehouseId },
        data: {
          currentOccupancyPallets: newOccupancy,
        },
      });

      return { updatedRequest, updatedWarehouse };
    });

    return res.status(200).json({
      success: true,
      message: 'Dispatch request completed successfully.',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'InsufficientInventory') {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stored inventory available to satisfy dispatch request at finalization.',
      });
    }
    if (error instanceof Error && error.message === 'WarehouseNotFound') {
      return res.status(404).json({
        success: false,
        message: 'Warehouse associated with request not found.',
      });
    }

    console.error('[DISPATCH] finalizeDispatchRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
