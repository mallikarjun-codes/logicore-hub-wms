import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

const ADMIN_EMAIL = 'billing.test.admin@waremind-test.ai';
const CLIENT_EMAIL = 'billing.test.client@waremind-test.ai';
const TEST_PASSWORD = 'SecurePass123!';

let adminToken;
let clientToken;

let testCompanyId;
let testProductId;
let testWarehouseId;
let testBinId;

// Test month and year (current date is July 2026)
const TEST_MONTH = 7;
const TEST_YEAR = 2026;

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // 1. Create a client company with BASIC plan
  const company = await prisma.company.create({
    data: {
      name: 'Billing Test Company',
      gstNumber: `GST-BI-TEST-${Date.now()}`,
      address: 'Billing Avenue 9',
      contactEmail: 'billing@testco.com',
      billingPlan: 'BASIC', // storage rate: 20, handling rate: 10
      priority: 'MEDIUM',
    },
  });
  testCompanyId = company.id;

  // 2. Create a product
  const product = await prisma.product.create({
    data: {
      sku: `SKU-BI-TEST-${Date.now()}`,
      name: 'Billing Test Product',
      category: 'Clothing',
      weight: 0.5,
      dimensions: '5x5x5 cm',
      companyId: testCompanyId,
    },
  });
  testProductId = product.id;

  // 3. Create a warehouse with a bin
  const warehouse = await prisma.warehouse.create({
    data: {
      name: 'Billing Test Warehouse',
      location: 'Billing City',
      totalCapacityPallets: 50,
      currentOccupancyPallets: 3,
      zones: {
        create: {
          name: 'Zone B',
          racks: {
            create: {
              name: 'Rack B01',
              shelves: {
                create: {
                  name: 'Shelf B1',
                  bins: {
                    create: {
                      name: 'Bin B1',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    include: {
      zones: {
        include: {
          racks: {
            include: {
              shelves: {
                include: {
                  bins: true,
                },
              },
            },
          },
        },
      },
    },
  });
  testWarehouseId = warehouse.id;
  testBinId = warehouse.zones[0].racks[0].shelves[0].bins[0].id;

  // 4. Create active inventories
  // Inventory 1: 150 quantity -> ceil(150/100) = 2 pallets
  await prisma.inventory.create({
    data: {
      quantity: 150,
      arrivalDate: new Date(TEST_YEAR, TEST_MONTH - 1, 15),
      status: 'STORED',
      productId: testProductId,
      companyId: testCompanyId,
      warehouseId: testWarehouseId,
      binId: testBinId,
    },
  });

  // Inventory 2: 50 quantity -> ceil(50/100) = 1 pallet
  // Total active pallets = 3. Storage charges: 3 * $20 = $60.
  await prisma.inventory.create({
    data: {
      quantity: 50,
      arrivalDate: new Date(TEST_YEAR, TEST_MONTH - 1, 20),
      status: 'STORED',
      productId: testProductId,
      companyId: testCompanyId,
      warehouseId: testWarehouseId,
      binId: testBinId,
    },
  });

  // 5. Create executed storage and dispatch requests within July 2026
  // StorageRequest 1: status STORED -> 1 request
  await prisma.storageRequest.create({
    data: {
      status: 'STORED',
      requestedPallets: 2,
      itemsDetails: { productId: testProductId, quantity: 150 },
      companyId: testCompanyId,
      warehouseId: testWarehouseId,
      createdAt: new Date(TEST_YEAR, TEST_MONTH - 1, 15),
      updatedAt: new Date(TEST_YEAR, TEST_MONTH - 1, 15),
    },
  });

  // DispatchRequest 1: status DISPATCHED -> 1 request
  // Total handling requests = 2. Handling charges: 2 * $10 = $20.
  await prisma.dispatchRequest.create({
    data: {
      status: 'DISPATCHED',
      itemsDetails: { productId: testProductId, quantity: 50, requestedPallets: 1 },
      companyId: testCompanyId,
      warehouseId: testWarehouseId,
      createdAt: new Date(TEST_YEAR, TEST_MONTH - 1, 20),
      updatedAt: new Date(TEST_YEAR, TEST_MONTH - 1, 20),
    },
  });

  // 6. Create users
  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Billing Admin',
      role: 'SUPER_ADMIN',
    },
  });

  await prisma.user.create({
    data: {
      email: CLIENT_EMAIL,
      passwordHash,
      name: 'Billing Client',
      role: 'CLIENT',
      companyId: testCompanyId,
    },
  });

  // 7. Login and get tokens
  const login = async (email) => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    return res.body.data.token;
  };

  adminToken = await login(ADMIN_EMAIL);
  clientToken = await login(CLIENT_EMAIL);
});

afterAll(async () => {
  // Clean up DB
  await prisma.invoice.deleteMany({ where: { companyId: testCompanyId } });
  await prisma.inventory.deleteMany({ where: { warehouseId: testWarehouseId } });
  await prisma.storageRequest.deleteMany({ where: { warehouseId: testWarehouseId } });
  await prisma.dispatchRequest.deleteMany({ where: { warehouseId: testWarehouseId } });
  await prisma.product.deleteMany({ where: { companyId: testCompanyId } });
  await prisma.user.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, CLIENT_EMAIL] } },
  });
  await prisma.warehouse.deleteMany({ where: { id: testWarehouseId } });
  await prisma.company.deleteMany({ where: { id: testCompanyId } });
  await prisma.$disconnect();
});

describe('Billing API — POST /api/billing/invoices/generate', () => {
  it('CLIENT should receive a 403 Forbidden when attempting to trigger invoice generation (Billing Test 1)', async () => {
    const res = await request(app)
      .post('/api/billing/invoices/generate')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        companyId: testCompanyId,
        month: TEST_MONTH,
        year: TEST_YEAR,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('SUPER_ADMIN should generate invoice with accurate billing math calculations (Billing Test 2)', async () => {
    const res = await request(app)
      .post('/api/billing/invoices/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyId: testCompanyId,
        month: TEST_MONTH,
        year: TEST_YEAR,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const invoice = res.body.data;
    expect(invoice.companyId).toBe(testCompanyId);
    expect(invoice.month).toBe(TEST_MONTH);
    expect(invoice.year).toBe(TEST_YEAR);
    expect(invoice.status).toBe('UNPAID');

    // Storage charges: 3 pallets * $20 rate = $60
    expect(invoice.storageCharges).toBe(60.0);

    // Handling charges: 2 requests * $10 fee = $20
    expect(invoice.handlingCharges).toBe(20.0);

    // Total: $60 + $20 = $80
    expect(invoice.totalAmount).toBe(80.0);
  });
});

describe('Billing API — GET /api/billing/invoices', () => {
  it('CLIENT should view only their own invoices (Billing Test 1 check)', async () => {
    const res = await request(app)
      .get('/api/billing/invoices')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    for (const invoice of res.body.data) {
      expect(invoice.companyId).toBe(testCompanyId);
    }
  });

  it('SUPER_ADMIN should view all invoices and support optional status filter', async () => {
    // Without filter
    const resAll = await request(app)
      .get('/api/billing/invoices')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAll.status).toBe(200);
    expect(resAll.body.data.length).toBeGreaterThanOrEqual(1);

    // With UNPAID filter
    const resUnpaid = await request(app)
      .get('/api/billing/invoices?status=UNPAID')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resUnpaid.status).toBe(200);
    for (const invoice of resUnpaid.body.data) {
      expect(invoice.status).toBe('UNPAID');
    }

    // With PAID filter (should be empty initially)
    const resPaid = await request(app)
      .get('/api/billing/invoices?status=PAID')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resPaid.status).toBe(200);
    for (const invoice of resPaid.body.data) {
      expect(invoice.status).toBe('PAID');
    }
  });
});

describe('Billing API — PUT /api/billing/invoices/:id/pay', () => {
  it('should accurately pay an invoice and transition the state to PAID (Billing Test 3)', async () => {
    // 1. Fetch unpaid invoice
    const invoicesRes = await request(app)
      .get('/api/billing/invoices')
      .set('Authorization', `Bearer ${clientToken}`);
    
    const unpaidInvoice = invoicesRes.body.data.find(inv => inv.status === 'UNPAID');
    expect(unpaidInvoice).toBeDefined();

    // 2. Pay invoice
    const payRes = await request(app)
      .put(`/api/billing/invoices/${unpaidInvoice.id}/pay`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(payRes.status).toBe(200);
    expect(payRes.body.success).toBe(true);
    expect(payRes.body.data.status).toBe('PAID');

    // 3. Verify it is PAID in database
    const invoiceDb = await prisma.invoice.findUnique({
      where: { id: unpaidInvoice.id }
    });
    expect(invoiceDb.status).toBe('PAID');
  });
});
