import prisma from '../config/prisma.js';

/**
 * GET /api/warehouses
 * - SUPER_ADMIN: Returns all warehouses with capacity stats.
 * - WAREHOUSE_MANAGER / WAREHOUSE_STAFF: Returns only their assigned warehouse.
 * - CLIENT: Forbidden (enforced at route level via authorizeRoles).
 */
export const getWarehouses = async (req, res) => {
  try {
    const { role, warehouseId } = req.user;

    if (role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE_STAFF') {
      if (!warehouseId) {
        res.status(400).json({
          success: false,
          message: 'No warehouse assigned to your account.',
        });
        return;
      }

      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: {
          id: true,
          name: true,
          location: true,
          totalCapacityPallets: true,
          currentOccupancyPallets: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { zones: true, users: true },
          },
        },
      });

      if (!warehouse) {
        res.status(404).json({ success: false, message: 'Assigned warehouse not found.' });
        return;
      }

      res.status(200).json({ success: true, data: warehouse });
      return;
    }

    // SUPER_ADMIN — return all warehouses
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        location: true,
        totalCapacityPallets: true,
        currentOccupancyPallets: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { zones: true, users: true, inventories: true },
        },
      },
    });

    res.status(200).json({ success: true, data: warehouses, total: warehouses.length });
  } catch (error) {
    console.error('[WAREHOUSE] getWarehouses error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * GET /api/warehouses/:id/grid
 * Deep-fetches the full Zone → Rack → Shelf → Bin hierarchy for a given warehouse.
 * Accessible by SUPER_ADMIN (any warehouse) and WAREHOUSE_MANAGER/STAFF (own warehouse only).
 */
export const getWarehouseGrid = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, warehouseId } = req.user;

    // Warehouse staff can only view their own warehouse grid
    if (
      (role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE_STAFF') &&
      warehouseId !== id
    ) {
      res.status(403).json({
        success: false,
        message: 'You can only view the grid for your assigned warehouse.',
      });
      return;
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        zones: {
          orderBy: { name: 'asc' },
          include: {
            racks: {
              orderBy: { name: 'asc' },
              include: {
                currentCompany: {
                  select: { id: true, name: true },
                },
                shelves: {
                  orderBy: { name: 'asc' },
                  include: {
                    bins: {
                      orderBy: { name: 'asc' },
                      include: {
                        inventories: {
                          where: { status: { in: ['STORED', 'ALLOCATED'] } },
                          select: {
                            id: true,
                            quantity: true,
                            status: true,
                            product: { select: { id: true, sku: true, name: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!warehouse) {
      res.status(404).json({
        success: false,
        message: `Warehouse with ID '${id}' not found.`,
      });
      return;
    }

    res.status(200).json({ success: true, data: warehouse });
  } catch (error) {
    console.error('[WAREHOUSE] getWarehouseGrid error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * GET /api/warehouses/racks/available
 * Returns racks that are either:
 *   (a) Unallocated — currentCompanyId IS NULL, or
 *   (b) Allocated exclusively to the requesting CLIENT's companyId.
 *
 * This enforces Business Rule 3: a rack can hold only ONE company's goods at a time.
 * Accessible by CLIENT users (scoped) and SUPER_ADMIN (returns all available racks).
 */
export const getAvailableRacks = async (req, res) => {
  try {
    const { role, companyId } = req.user;

    let whereClause;

    if (role === 'CLIENT') {
      if (!companyId) {
        res.status(400).json({ success: false, message: 'No company associated with your account.' });
        return;
      }
      // A rack is "available" for this client if it's empty OR already theirs
      whereClause = {
        OR: [
          { currentCompanyId: null },
          { currentCompanyId: companyId },
        ],
      };
    } else {
      // SUPER_ADMIN sees all unallocated racks
      whereClause = { currentCompanyId: null };
    }

    const racks = await prisma.rack.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        currentCompanyId: true,
        currentCompany: { select: { id: true, name: true } },
        zone: {
          select: {
            id: true,
            name: true,
            warehouse: { select: { id: true, name: true, location: true } },
          },
        },
        _count: { select: { shelves: true } },
      },
    });

    res.status(200).json({ success: true, data: racks, total: racks.length });
  } catch (error) {
    console.error('[WAREHOUSE] getAvailableRacks error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
