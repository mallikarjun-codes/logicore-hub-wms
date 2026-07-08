import { GoogleGenAI } from '@google/genai';
import prisma from '../config/prisma.js';

const VALID_CONTEXT_PAGES = ['dashboard', 'inventory', 'billing', 'warehouse'];

/**
 * POST /api/ai/copilot
 * Interaction with the WareMind AI Copilot. Context-aware and tenant-scoped.
 */
export const askCopilot = async (req, res) => {
  try {
    const { userId, role, companyId, warehouseId } = req.user;
    const { message, contextPage } = req.body;

    if (!message || !contextPage) {
      return res.status(400).json({
        success: false,
        message: 'message and contextPage are required in the request body.',
      });
    }

    if (!VALID_CONTEXT_PAGES.includes(contextPage)) {
      return res.status(400).json({
        success: false,
        message: `Invalid contextPage. Valid options are: ${VALID_CONTEXT_PAGES.join(', ')}.`,
      });
    }

    // 1. Contextual Aggregation Layer (strictly tenant-isolated)
    let contextData = {};

    switch (contextPage) {
      case 'inventory':
        if (role === 'CLIENT') {
          if (!companyId) {
            return res.status(400).json({
              success: false,
              message: 'No company associated with your account.',
            });
          }
          // Fetch products and active inventory counts belonging strictly to the client's company
          const products = await prisma.product.findMany({
            where: { companyId },
            include: {
              _count: {
                select: {
                  inventories: {
                    where: { status: { in: ['STORED', 'ALLOCATED'] } },
                  },
                },
              },
            },
          });
          contextData = products.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            category: p.category,
            activeInventoryCount: p._count.inventories,
          }));
        } else {
          // Non-clients (managers, admins) see all products or manager's warehouse active products
          const whereClause = warehouseId
            ? {
                inventories: {
                  some: {
                    warehouseId,
                    status: { in: ['STORED', 'ALLOCATED'] },
                  },
                },
              }
            : {};

          const products = await prisma.product.findMany({
            where: whereClause,
            include: {
              _count: {
                select: {
                  inventories: {
                    where: { status: { in: ['STORED', 'ALLOCATED'] } },
                  },
                },
              },
            },
          });
          contextData = products.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            category: p.category,
            activeInventoryCount: p._count.inventories,
          }));
        }
        break;

      case 'billing':
        if (role === 'CLIENT') {
          if (!companyId) {
            return res.status(400).json({
              success: false,
              message: 'No company associated with your account.',
            });
          }
          // Fetch recent invoices and aggregate sums strictly for the client's company
          const invoices = await prisma.invoice.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            take: 10,
          });
          const paidSum = invoices
            .filter((i) => i.status === 'PAID')
            .reduce((acc, i) => acc + i.totalAmount, 0);
          const unpaidSum = invoices
            .filter((i) => i.status === 'UNPAID')
            .reduce((acc, i) => acc + i.totalAmount, 0);

          contextData = {
            invoices: invoices.map((i) => ({
              id: i.id,
              month: i.month,
              year: i.year,
              totalAmount: i.totalAmount,
              status: i.status,
            })),
            paidSum,
            unpaidSum,
          };
        } else {
          // Admins/managers see overall billing totals or invoices they can access
          const invoices = await prisma.invoice.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
          });
          const paidSum = invoices
            .filter((i) => i.status === 'PAID')
            .reduce((acc, i) => acc + i.totalAmount, 0);
          const unpaidSum = invoices
            .filter((i) => i.status === 'UNPAID')
            .reduce((acc, i) => acc + i.totalAmount, 0);

          contextData = {
            invoices: invoices.map((i) => ({
              id: i.id,
              month: i.month,
              year: i.year,
              totalAmount: i.totalAmount,
              status: i.status,
              companyId: i.companyId,
            })),
            paidSum,
            unpaidSum,
          };
        }
        break;

      case 'warehouse':
        // Fetch total capacity vs current occupancy numbers for manager's warehouse (or all for admins)
        if (warehouseId) {
          const wh = await prisma.warehouse.findUnique({
            where: { id: warehouseId },
            select: {
              id: true,
              name: true,
              location: true,
              totalCapacityPallets: true,
              currentOccupancyPallets: true,
            },
          });
          contextData = wh || {};
        } else {
          contextData = await prisma.warehouse.findMany({
            select: {
              id: true,
              name: true,
              location: true,
              totalCapacityPallets: true,
              currentOccupancyPallets: true,
            },
          });
        }
        break;

      case 'dashboard':
        // Broad statistical summary matching role
        if (role === 'CLIENT') {
          const productCount = await prisma.product.count({ where: { companyId } });
          const activeInventoryCount = await prisma.inventory.count({
            where: { companyId, status: { in: ['STORED', 'ALLOCATED'] } },
          });
          const invoices = await prisma.invoice.findMany({ where: { companyId } });
          const unpaidInvoices = invoices.filter((i) => i.status === 'UNPAID');

          contextData = {
            role,
            productCount,
            activeInventoryCount,
            unpaidInvoiceCount: unpaidInvoices.length,
            unpaidInvoiceAmount: unpaidInvoices.reduce((acc, i) => acc + i.totalAmount, 0),
          };
        } else if (role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE_STAFF') {
          const warehouse = warehouseId ? await prisma.warehouse.findUnique({ where: { id: warehouseId } }) : null;
          const pendingStorage = warehouseId
            ? await prisma.storageRequest.count({ where: { warehouseId, status: 'PENDING' } })
            : 0;
          const pendingDispatch = warehouseId
            ? await prisma.dispatchRequest.count({ where: { warehouseId, status: 'PENDING' } })
            : 0;

          contextData = {
            role,
            warehouseName: warehouse?.name || 'Unknown',
            totalCapacityPallets: warehouse?.totalCapacityPallets || 0,
            currentOccupancyPallets: warehouse?.currentOccupancyPallets || 0,
            pendingStorageRequests: pendingStorage,
            pendingDispatchRequests: pendingDispatch,
          };
        } else {
          // SUPER_ADMIN summary
          const whCount = await prisma.warehouse.count();
          const coCount = await prisma.company.count();
          const uCount = await prisma.user.count();
          const unpaidInvoices = await prisma.invoice.count({ where: { status: 'UNPAID' } });

          contextData = {
            role,
            warehouseCount: whCount,
            companyCount: coCount,
            userCount: uCount,
            unpaidInvoicesCount: unpaidInvoices,
          };
        }
        break;
    }

    // 2. System Prompt Injection
    let systemInstruction = '';
    const dataStr = JSON.stringify(contextData, null, 2);

    switch (contextPage) {
      case 'inventory':
        systemInstruction = `You are the WareMind AI Inventory Analyst. You are given the active database records of the user's products and their active inventory counts: ${dataStr}. Answer the user's inquiry accurately based on these inventory records. Do not hallucinate data.`;
        break;
      case 'billing':
        systemInstruction = `You are the WareMind AI Billing Analyst. You are given the active database records of the user's invoices here: ${dataStr}. Answer the user's inquiry accurately based on these balances. Do not hallucinate data.`;
        break;
      case 'warehouse':
        systemInstruction = `You are the WareMind AI Warehouse Operations Analyst. You are given the active warehouse capacity and occupancy records: ${dataStr}. Answer the user's inquiry accurately based on these occupancy records. Do not hallucinate data.`;
        break;
      case 'dashboard':
        systemInstruction = `You are the WareMind AI Business Intelligence Analyst. You are given a high-level statistical summary matching your role: ${dataStr}. Answer the user's inquiry accurately based on these statistics. Do not hallucinate data.`;
        break;
    }

    // 3. Invoke Google Gemini API
    const ai = new GoogleGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction,
      },
    });

    const aiText = response.text || 'No response generated.';

    // 4. Save exchange to Audit Logs
    const history = await prisma.aIChatHistory.create({
      data: {
        userId,
        contextPage,
        message,
        response: aiText,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'AI Copilot response generated.',
      data: {
        response: aiText,
        historyId: history.id,
      },
    });
  } catch (error) {
    console.error('[AI COPILOT] askCopilot error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred in AI Copilot.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
