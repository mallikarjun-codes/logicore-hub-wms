import { Request, Response } from 'express';
import { Priority } from '@prisma/client';
import prisma from '../config/prisma';

/**
 * POST /api/companies
 * Creates a new client company. SUPER_ADMIN only.
 */
export const createCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, gstNumber, address, contactEmail, billingPlan, priority } = req.body as {
      name?: string;
      gstNumber?: string;
      address?: string;
      contactEmail?: string;
      billingPlan?: string;
      priority?: Priority;
    };

    // Validate required fields
    if (!name || !gstNumber || !address || !contactEmail || !billingPlan) {
      res.status(400).json({
        success: false,
        message: 'name, gstNumber, address, contactEmail, and billingPlan are all required.',
      });
      return;
    }

    // Validate priority enum if provided
    const validPriorities = Object.values(Priority);
    if (priority && !validPriorities.includes(priority)) {
      res.status(400).json({
        success: false,
        message: `Invalid priority. Valid values are: ${validPriorities.join(', ')}.`,
      });
      return;
    }

    // Check for duplicate GST number
    const existingCompany = await prisma.company.findUnique({ where: { gstNumber } });
    if (existingCompany) {
      res.status(400).json({
        success: false,
        message: `A company with GST number '${gstNumber}' already exists.`,
      });
      return;
    }

    const company = await prisma.company.create({
      data: {
        name,
        gstNumber,
        address,
        contactEmail,
        billingPlan,
        priority: priority ?? Priority.MEDIUM,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Company created successfully.',
      data: company,
    });
  } catch (error) {
    console.error('[COMPANY] createCompany error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred while creating the company.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * GET /api/companies
 * Returns all companies with aggregated inventory and active storage request counts.
 * SUPER_ADMIN only.
 */
export const getAllCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        gstNumber: true,
        address: true,
        contactEmail: true,
        billingPlan: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            inventories: true,
            storageRequests: true,
            users: true,
            products: true,
          },
        },
        // Active storage requests only
        storageRequests: {
          where: {
            status: { in: ['PENDING', 'APPROVED', 'ARRIVED'] },
          },
          select: { id: true, status: true },
        },
      },
    });

    // Annotate each company with an activeStorageRequestCount derived value
    const result = companies.map((c) => ({
      ...c,
      activeStorageRequestCount: c.storageRequests.length,
      storageRequests: undefined, // strip raw array; count is the useful data
    }));

    res.status(200).json({
      success: true,
      data: result,
      total: result.length,
    });
  } catch (error) {
    console.error('[COMPANY] getAllCompanies error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred while fetching companies.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * GET /api/companies/:id
 * Returns full details of a single company by ID.
 * SUPER_ADMIN only.
 */
export const getCompanyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        },
        products: {
          select: {
            id: true,
            sku: true,
            name: true,
            category: true,
          },
        },
        _count: {
          select: {
            inventories: true,
            storageRequests: true,
            dispatchRequests: true,
            invoices: true,
          },
        },
      },
    });

    if (!company) {
      res.status(404).json({
        success: false,
        message: `Company with ID '${id}' not found.`,
      });
      return;
    }

    res.status(200).json({ success: true, data: company });
  } catch (error) {
    console.error('[COMPANY] getCompanyById error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred while fetching the company.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * PUT /api/companies/:id
 * Updates billing plan, priority, or other mutable details.
 * SUPER_ADMIN only.
 */
export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, address, contactEmail, billingPlan, priority } = req.body as {
      name?: string;
      address?: string;
      contactEmail?: string;
      billingPlan?: string;
      priority?: Priority;
    };

    // Validate priority enum if provided
    if (priority) {
      const validPriorities = Object.values(Priority);
      if (!validPriorities.includes(priority)) {
        res.status(400).json({
          success: false,
          message: `Invalid priority. Valid values are: ${validPriorities.join(', ')}.`,
        });
        return;
      }
    }

    // Ensure company exists
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({
        success: false,
        message: `Company with ID '${id}' not found.`,
      });
      return;
    }

    // Build the update object with only the provided fields
    const updateData: {
      name?: string;
      address?: string;
      contactEmail?: string;
      billingPlan?: string;
      priority?: Priority;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
    if (billingPlan !== undefined) updateData.billingPlan = billingPlan;
    if (priority !== undefined) updateData.priority = priority;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No updatable fields were provided in the request body.',
      });
      return;
    }

    const updatedCompany = await prisma.company.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      message: 'Company updated successfully.',
      data: updatedCompany,
    });
  } catch (error) {
    console.error('[COMPANY] updateCompany error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred while updating the company.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * DELETE /api/companies/:id
 * Deletes a company — but only if they have NO active inventory (STORED or ALLOCATED).
 * SUPER_ADMIN only.
 */
export const deleteCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({
        success: false,
        message: `Company with ID '${id}' not found.`,
      });
      return;
    }

    // Safety check: block deletion if active inventory exists
    const activeInventoryCount = await prisma.inventory.count({
      where: {
        companyId: id,
        status: { in: ['STORED', 'ALLOCATED'] },
      },
    });

    if (activeInventoryCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete company '${existing.name}'. They have ${activeInventoryCount} active inventory record(s) (STORED or ALLOCATED). Clear or dispatch inventory before deleting.`,
      });
      return;
    }

    // Safe to delete — Cascade rules in Prisma schema will clean up related records
    await prisma.company.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: `Company '${existing.name}' was permanently deleted.`,
    });
  } catch (error) {
    console.error('[COMPANY] deleteCompany error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred while deleting the company.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
