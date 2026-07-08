import { GoogleGenAI } from '@google/genai';
import prisma from '../config/prisma.js';

const VALID_CONTEXT_PAGES = ['dashboard', 'inventory', 'billing', 'warehouse'];

/**
 * Builds a tenant-scoped Prisma dataset based on the active UI page context.
 * All queries are isolated to the authenticated user's companyId / warehouseId.
 *
 * @param {string} contextPage
 * @param {{ userId, role, companyId, warehouseId }} user
 * @returns {Promise<object>}
 */
async function buildContextData(contextPage, { role, companyId, warehouseId }) {
  switch (contextPage) {
    case 'inventory': {
      // CLIENT sees only their company's products; managers see their warehouse's active stock; admin sees all
      const whereClause =
        role === 'CLIENT'
          ? { companyId }
          : role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE_STAFF'
            ? { inventories: { some: { warehouseId, status: { in: ['STORED', 'ALLOCATED'] } } } }
            : {};

      const products = await prisma.product.findMany({
        where: whereClause,
        include: {
          company: { select: { name: true } },
          _count: {
            select: {
              inventories: { where: { status: { in: ['STORED', 'ALLOCATED'] } } },
            },
          },
        },
      });

      return products.map(p => ({
        sku: p.sku,
        name: p.name,
        category: p.category,
        company: p.company?.name ?? null,
        activeInventoryCount: p._count.inventories,
      }));
    }

    case 'billing': {
      const whereClause = role === 'CLIENT' ? { companyId } : {};
      const invoices = await prisma.invoice.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { company: { select: { name: true } } },
      });

      const paidSum   = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0);
      const unpaidSum = invoices.filter(i => i.status === 'UNPAID').reduce((s, i) => s + i.totalAmount, 0);

      return {
        invoices: invoices.map(i => ({
          month: i.month,
          year: i.year,
          totalAmount: i.totalAmount,
          status: i.status,
          company: i.company?.name ?? null,
        })),
        paidSum,
        unpaidSum,
      };
    }

    case 'warehouse': {
      if (warehouseId) {
        return await prisma.warehouse.findUnique({
          where: { id: warehouseId },
          select: { name: true, location: true, totalCapacityPallets: true, currentOccupancyPallets: true },
        }) ?? {};
      }
      return await prisma.warehouse.findMany({
        select: { name: true, location: true, totalCapacityPallets: true, currentOccupancyPallets: true },
      });
    }

    case 'dashboard': {
      if (role === 'CLIENT') {
        const [productCount, activeInventoryCount, invoices] = await Promise.all([
          prisma.product.count({ where: { companyId } }),
          prisma.inventory.count({ where: { companyId, status: { in: ['STORED', 'ALLOCATED'] } } }),
          prisma.invoice.findMany({ where: { companyId } }),
        ]);
        const unpaid = invoices.filter(i => i.status === 'UNPAID');
        return {
          role,
          productCount,
          activeInventoryCount,
          unpaidInvoiceCount: unpaid.length,
          unpaidInvoiceAmount: unpaid.reduce((s, i) => s + i.totalAmount, 0),
        };
      }
      if (role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE_STAFF') {
        const [warehouse, pendingStorage, pendingDispatch] = await Promise.all([
          warehouseId ? prisma.warehouse.findUnique({ where: { id: warehouseId } }) : null,
          warehouseId ? prisma.storageRequest.count({ where: { warehouseId, status: 'PENDING' } }) : 0,
          warehouseId ? prisma.dispatchRequest.count({ where: { warehouseId, status: 'PENDING' } }) : 0,
        ]);
        return {
          role,
          warehouseName: warehouse?.name ?? 'Unknown',
          totalCapacityPallets: warehouse?.totalCapacityPallets ?? 0,
          currentOccupancyPallets: warehouse?.currentOccupancyPallets ?? 0,
          pendingStorageRequests: pendingStorage,
          pendingDispatchRequests: pendingDispatch,
        };
      }
      // SUPER_ADMIN — platform-wide summary
      const [whCount, coCount, uCount, unpaidCount] = await Promise.all([
        prisma.warehouse.count(),
        prisma.company.count(),
        prisma.user.count(),
        prisma.invoice.count({ where: { status: 'UNPAID' } }),
      ]);
      return { role, warehouseCount: whCount, companyCount: coCount, userCount: uCount, unpaidInvoicesCount: unpaidCount };
    }

    default:
      return {};
  }
}

/**
 * Builds the system instruction string that is injected as context into Gemini.
 * The live database snapshot is embedded directly inside the instruction.
 *
 * @param {string} contextPage
 * @param {object} contextData - the live Prisma query result
 * @returns {string}
 */
function buildSystemInstruction(contextPage, contextData) {
  const dataStr = JSON.stringify(contextData, null, 2);
  const base = `You are WareMind AI, an intelligent operations copilot for a 3PL (third-party logistics) Warehouse Management System.
You are authoritative, concise, and strictly data-driven. Never hallucinate, estimate, or invent numbers.
Always base your answers on the live database snapshot provided below.
If a user asks something outside the scope of the provided data, say so clearly.`;

  const contextIntros = {
    inventory: `You are currently acting as the Inventory Analyst.
Live product catalog snapshot (tenant-scoped):
${dataStr}`,
    billing: `You are currently acting as the Billing & Finance Analyst.
Live invoice data snapshot (tenant-scoped):
${dataStr}`,
    warehouse: `You are currently acting as the Warehouse Operations Analyst.
Live warehouse capacity and occupancy snapshot:
${dataStr}`,
    dashboard: `You are currently acting as the Business Intelligence Analyst.
Live operational summary snapshot for this user's role and tenant:
${dataStr}`,
  };

  return `${base}\n\n${contextIntros[contextPage] ?? `Live context data:\n${dataStr}`}`;
}

/**
 * POST /api/ai/copilot
 * Context-aware, tenant-scoped AI copilot powered by Google Gemini.
 */
export const askCopilot = async (req, res) => {
  try {
    const { userId, role, companyId, warehouseId } = req.user;
    const { message, contextPage } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!message?.trim() || !contextPage) {
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

    // ── API key guard — fail fast with a clear message ────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_ACTUAL_API_KEY_HERE') {
      return res.status(503).json({
        success: false,
        message:
          'The Gemini API key is not configured. ' +
          'Set GEMINI_API_KEY in backend/.env with a valid key from https://aistudio.google.com/apikey, then restart the server.',
      });
    }

    // ── 1. Build tenant-scoped context data from live Prisma queries ─────────
    const contextData = await buildContextData(contextPage, { role, companyId, warehouseId });

    // ── 2. Construct the dynamic system instruction with embedded data ────────
    const systemInstruction = buildSystemInstruction(contextPage, contextData);

    // ── 3. Invoke Google Gemini API ───────────────────────────────────────────
    // Pass apiKey explicitly — do NOT rely on the GOOGLE_API_KEY env var name
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message.trim(),
      config: {
        systemInstruction,
        // Keep response focused and within a reasonable token budget
        maxOutputTokens: 1024,
        temperature: 0.4,
      },
    });

    // The @google/genai SDK returns the text via response.text (getter, not property)
    const aiText = response.text ?? 'No response was generated. Please try rephrasing your question.';

    // ── 4. Persist exchange in audit log ─────────────────────────────────────
    const history = await prisma.aIChatHistory.create({
      data: {
        userId,
        contextPage,
        message: message.trim(),
        response: aiText,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'AI Copilot response generated successfully.',
      data: {
        response: aiText,
        historyId: history.id,
        contextPage,
      },
    });

  } catch (error) {
    console.error('[AI COPILOT] askCopilot error:', error);

    // Surface Gemini-specific errors clearly to aid debugging
    const isApiError = error?.message?.includes('API_KEY') || error?.message?.includes('INVALID_ARGUMENT');
    return res.status(isApiError ? 401 : 500).json({
      success: false,
      message: isApiError
        ? `Gemini API key error: ${error.message}`
        : 'An internal server error occurred in the AI Copilot.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
