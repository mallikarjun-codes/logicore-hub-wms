import prisma from '../config/prisma.js';

/**
 * POST /api/storage/requests
 * Creates a new storage request. 'CLIENT' role only.
 */
export const createStorageRequest = async (req, res) => {
  try {
    const { role, companyId } = req.user;
    const { productId, requestedPallets, quantity, warehouseId } = req.body;

    if (!productId || requestedPallets === undefined || quantity === undefined || !warehouseId) {
      return res.status(400).json({
        success: false,
        message: 'productId, requestedPallets, quantity, and warehouseId are required.',
      });
    }

    if (role !== 'CLIENT') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Only CLIENT role can create storage requests.',
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'No company associated with your account.',
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

    const storageRequest = await prisma.storageRequest.create({
      data: {
        status: 'PENDING',
        requestedPallets: parseInt(requestedPallets, 10),
        itemsDetails: { productId, quantity: parseInt(quantity, 10) },
        companyId,
        warehouseId,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Storage request created successfully.',
      data: storageRequest,
    });
  } catch (error) {
    console.error('[STORAGE] createStorageRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * PUT /api/storage/requests/:id/approve
 * Approves a storage request. 'WAREHOUSE_MANAGER' or 'SUPER_ADMIN' only.
 */
export const approveStorageRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, warehouseId } = req.user;

    const request = await prisma.storageRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: `Storage request with ID '${id}' not found.`,
      });
    }

    // Warehouse manager can only approve requests for their own warehouse
    if (role === 'WAREHOUSE_MANAGER' && warehouseId !== request.warehouseId) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You can only approve requests for your assigned warehouse.',
      });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve request in '${request.status}' status. Only PENDING requests can be approved.`,
      });
    }

    const updated = await prisma.storageRequest.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    return res.status(200).json({
      success: true,
      message: 'Storage request approved successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('[STORAGE] approveStorageRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * PUT /api/storage/requests/:id/arrive
 * Marks a storage request as arrived. Warehouse staff/manager or super admin only.
 */
export const arriveStorageRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, warehouseId } = req.user;

    const request = await prisma.storageRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: `Storage request with ID '${id}' not found.`,
      });
    }

    // Warehouse staff/manager can only arrive requests for their own warehouse
    if (
      (role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE_STAFF') &&
      warehouseId !== request.warehouseId
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You can only mark arrivals for your assigned warehouse.',
      });
    }

    if (request.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: `Cannot mark request as arrived in '${request.status}' status. Only APPROVED requests can be marked as arrived.`,
      });
    }

    const updated = await prisma.storageRequest.update({
      where: { id },
      data: { status: 'ARRIVED' },
    });

    return res.status(200).json({
      success: true,
      message: 'Storage request marked as arrived.',
      data: updated,
    });
  } catch (error) {
    console.error('[STORAGE] arriveStorageRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * PUT /api/storage/requests/:id/store
 * Finalizes the storage request. Maps inventory to a bin and increases occupancy.
 */
export const storeStorageRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, warehouseId } = req.user;
    const { binId } = req.body;

    if (!binId) {
      return res.status(400).json({
        success: false,
        message: 'binId is required in the request body.',
      });
    }

    const request = await prisma.storageRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: `Storage request with ID '${id}' not found.`,
      });
    }

    // Warehouse staff/manager can only store requests for their own warehouse
    if (
      (role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE_STAFF') &&
      warehouseId !== request.warehouseId
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You can only finalize storage for your assigned warehouse.',
      });
    }

    if (request.status !== 'ARRIVED') {
      return res.status(400).json({
        success: false,
        message: `Cannot store request in '${request.status}' status. Only ARRIVED requests can be stored.`,
      });
    }

    // Verify the target bin exists
    const bin = await prisma.bin.findUnique({
      where: { id: binId },
      include: {
        shelf: {
          include: {
            rack: {
              include: {
                zone: true
              }
            }
          }
        }
      }
    });

    if (!bin) {
      return res.status(404).json({
        success: false,
        message: `Bin with ID '${binId}' not found.`,
      });
    }

    // Check that the bin belongs to the warehouse of the request
    if (bin.shelf.rack.zone.warehouseId !== request.warehouseId) {
      return res.status(400).json({
        success: false,
        message: `Bin '${bin.name}' does not belong to the request's warehouse.`,
      });
    }

    // Run transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch warehouse capacity info
      const warehouse = await tx.warehouse.findUnique({
        where: { id: request.warehouseId },
      });

      if (!warehouse) {
        throw new Error('WarehouseNotFound');
      }

      // Check capacity limit
      if (warehouse.currentOccupancyPallets + request.requestedPallets > warehouse.totalCapacityPallets) {
        throw new Error('CapacityExceeded');
      }

      const details = request.itemsDetails;
      const productId = details.productId;
      const quantity = details.quantity;

      // 2. Change status to STORED
      const updatedRequest = await tx.storageRequest.update({
        where: { id },
        data: { status: 'STORED' },
      });

      // 3. Create a new Inventory record
      const newInventory = await tx.inventory.create({
        data: {
          quantity,
          arrivalDate: new Date(),
          status: 'STORED',
          productId,
          companyId: request.companyId,
          warehouseId: request.warehouseId,
          binId,
        },
      });

      // 4. Increment the warehouse's currentOccupancyPallets
      const updatedWarehouse = await tx.warehouse.update({
        where: { id: request.warehouseId },
        data: {
          currentOccupancyPallets: {
            increment: request.requestedPallets,
          },
        },
      });

      return { updatedRequest, newInventory, updatedWarehouse };
    });

    return res.status(200).json({
      success: true,
      message: 'Storage request finalized and inventory stored successfully.',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'CapacityExceeded') {
      return res.status(400).json({
        success: false,
        message: 'Storage request exceeds the warehouse capacity.',
      });
    }
    if (error instanceof Error && error.message === 'WarehouseNotFound') {
      return res.status(404).json({
        success: false,
        message: 'Warehouse associated with request not found.',
      });
    }

    console.error('[STORAGE] storeStorageRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
