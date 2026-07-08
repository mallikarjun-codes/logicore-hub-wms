import prisma from '../config/prisma.js';

// Base storage rates per pallet per month
const PLAN_STORAGE_RATES = {
  FREE: 30.0,
  BASIC: 20.0,
  PROFESSIONAL: 15.0,
  ENTERPRISE: 10.0,
};

// Handling charges per request execution
const PLAN_HANDLING_RATES = {
  FREE: 15.0,
  BASIC: 10.0,
  PROFESSIONAL: 8.0,
  ENTERPRISE: 5.0,
};

/**
 * POST /api/billing/invoices/generate
 * Admin/system trigger to generate a monthly invoice for a company.
 */
export const generateInvoice = async (req, res) => {
  try {
    const { role } = req.user;
    const { companyId, month, year } = req.body;

    if (role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Only SUPER_ADMIN can trigger invoice generation.',
      });
    }

    if (!companyId || month === undefined || year === undefined) {
      return res.status(400).json({
        success: false,
        message: 'companyId, month, and year are required.',
      });
    }

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (isNaN(m) || m < 1 || m > 12 || isNaN(y) || y < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month or year parameters.',
      });
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: `Company with ID '${companyId}' not found.`,
      });
    }

    const billingPlan = company.billingPlan || 'BASIC';
    const storageRate = PLAN_STORAGE_RATES[billingPlan] ?? 20.0;
    const handlingRate = PLAN_HANDLING_RATES[billingPlan] ?? 10.0;

    // 1. Calculate Storage Charges
    // Fetch all active inventory records for that company arrived on or before the end of the month
    const endDate = new Date(y, m, 1); // First day of next month
    const activeInventories = await prisma.inventory.findMany({
      where: {
        companyId,
        status: { in: ['STORED', 'ALLOCATED'] },
        arrivalDate: { lt: endDate },
      },
    });

    // Calculate cost based on stored pallets (1 pallet per 100 units, min 1 pallet per active record)
    const totalPallets = activeInventories.reduce((acc, inv) => {
      const pallets = Math.max(1, Math.ceil(inv.quantity / 100));
      return acc + pallets;
    }, 0);

    const storageCharges = totalPallets * storageRate;

    // 2. Calculate Handling Charges
    // Count executed StorageRequests (status: STORED) and DispatchRequests (status: DISPATCHED) within that month
    const startDate = new Date(y, m - 1, 1);

    const storageRequestsCount = await prisma.storageRequest.count({
      where: {
        companyId,
        status: 'STORED',
        updatedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    const dispatchRequestsCount = await prisma.dispatchRequest.count({
      where: {
        companyId,
        status: 'DISPATCHED',
        updatedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    const totalRequests = storageRequestsCount + dispatchRequestsCount;
    const handlingCharges = totalRequests * handlingRate;

    const totalAmount = storageCharges + handlingCharges;

    // 3. Create Invoice record
    const invoice = await prisma.invoice.create({
      data: {
        month: m,
        year: y,
        storageCharges,
        handlingCharges,
        totalAmount,
        status: 'UNPAID',
        companyId,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Invoice generated successfully.',
      data: invoice,
    });
  } catch (error) {
    console.error('[BILLING] generateInvoice error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * GET /api/billing/invoices
 * Retrieve invoices. Scoped by role.
 */
export const getInvoices = async (req, res) => {
  try {
    const { role, companyId } = req.user;
    const { status } = req.query;

    let whereClause = {};

    if (role === 'CLIENT') {
      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'No company associated with your account.',
        });
      }
      whereClause.companyId = companyId;
    } else if (role === 'SUPER_ADMIN') {
      if (status) {
        whereClause.status = status;
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden.',
      });
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json({
      success: true,
      data: invoices,
      total: invoices.length,
    });
  } catch (error) {
    console.error('[BILLING] getInvoices error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * PUT /api/billing/invoices/:id/pay
 * Simulates paying an invoice. Updates status to PAID.
 */
export const payInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, companyId } = req.user;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice with ID '${id}' not found.`,
      });
    }

    if (role === 'CLIENT' && invoice.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You cannot pay invoices for another company.',
      });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'PAID' },
    });

    return res.status(200).json({
      success: true,
      message: 'Invoice paid successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('[BILLING] payInvoice error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
