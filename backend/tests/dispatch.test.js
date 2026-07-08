import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

// Test identities
const ADMIN_EMAIL = 'dispatch.test.admin@waremind-test.ai';
const MANAGER_EMAIL = 'dispatch.test.manager@waremind-test.ai';
const STAFF_EMAIL = 'dispatch.test.staff@waremind-test.ai';
const CLIENT_EMAIL = 'dispatch.test.client@waremind-test.ai';
const TEST_PASSWORD = 'SecurePass123!';

let adminToken;
let managerToken;
let staffToken;
let clientToken;

let testCompanyId;
let testProductId;
let testWarehouseId;
let testBinId;
let testInventoryId;

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // 1. Create a client company
  const company = await prisma.company.create({
    data: {
      name: 'Dispatch Test Company',
      gstNumber: `GST-DI-${Date.now()}`,
      address: 'Dispatch St 101',
      contactEmail: 'logistics@dispatchtest.com',
      billingPlan: 'BASIC',
      priority: 'LOW',
    },
  });
  testCompanyId = company.id;

  // 2. Create a product for that company
  const product = await prisma.product.create({
    data: {
      sku: `SKU-DI-${Date.now()}`,
      name: 'Dispatch Test Product',
      category: 'Electronics',
      weight: 1.0,
      dimensions: '10x10x10 cm',
      companyId: testCompanyId,
    },
  });
  testProductId = product.id;

  // 3. Create a warehouse
  const warehouse = await prisma.warehouse.create({
    data: {
      name: 'Dispatch Test Warehouse',
      location: 'Dispatch City',
      totalCapacityPallets: 10,
      currentOccupancyPallets: 4, // Initial occupancy for the 200 units stored (say 2 pallets)
      zones: {
        create: {
          name: 'Zone D',
          racks: {
            create: {
              name: 'Rack D01',
              shelves: {
                create: {
                  name: 'Shelf D1',
                  bins: {
                    create: {
                      name: 'Bin D1',
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

  // 4. Create an active Inventory record (status STORED, quantity 200)
  const inventory = await prisma.inventory.create({
    data: {
      quantity: 200,
      arrivalDate: new Date(),
      status: 'STORED',
      productId: testProductId,
      companyId: testCompanyId,
      warehouseId: testWarehouseId,
      binId: testBinId,
    },
  });
  testInventoryId = inventory.id;

  // 5. Create users
  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Dispatch Admin',
      role: 'SUPER_ADMIN',
    },
  });

  await prisma.user.create({
    data: {
      email: MANAGER_EMAIL,
      passwordHash,
      name: 'Dispatch Manager',
      role: 'WAREHOUSE_MANAGER',
      warehouseId: testWarehouseId,
    },
  });

  await prisma.user.create({
    data: {
      email: STAFF_EMAIL,
      passwordHash,
      name: 'Dispatch Staff',
      role: 'WAREHOUSE_STAFF',
      warehouseId: testWarehouseId,
    },
  });

  await prisma.user.create({
    data: {
      email: CLIENT_EMAIL,
      passwordHash,
      name: 'Dispatch Client',
      role: 'CLIENT',
      companyId: testCompanyId,
    },
  });

  // 6. Login and retrieve tokens
  const login = async (email) => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    return res.body.data.token;
  };

  adminToken = await login(ADMIN_EMAIL);
  managerToken = await login(MANAGER_EMAIL);
  staffToken = await login(STAFF_EMAIL);
  clientToken = await login(CLIENT_EMAIL);
});

afterAll(async () => {
  // Clean up in reverse/safe FK order
  await prisma.inventory.deleteMany({ where: { warehouseId: testWarehouseId } });
  await prisma.dispatchRequest.deleteMany({ where: { warehouseId: testWarehouseId } });
  await prisma.product.deleteMany({ where: { companyId: testCompanyId } });
  await prisma.user.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, MANAGER_EMAIL, STAFF_EMAIL, CLIENT_EMAIL] } },
  });
  await prisma.warehouse.deleteMany({ where: { id: testWarehouseId } });
  await prisma.company.deleteMany({ where: { id: testCompanyId } });
  await prisma.$disconnect();
});

describe('Dispatch Request Workflows', () => {
  it('should reject dispatch request exceeding client owned available quantity (Dispatch Guard Test)', async () => {
    const res = await request(app)
      .post('/api/dispatch/requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        productId: testProductId,
        quantity: 201, // Client only has 200 stored
        warehouseId: testWarehouseId,
        requestedPallets: 2,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Insufficient inventory/i);
  });

  it('should allow CLIENT to create a valid dispatch request with status PENDING', async () => {
    const res = await request(app)
      .post('/api/dispatch/requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        productId: testProductId,
        quantity: 120,
        warehouseId: testWarehouseId,
        requestedPallets: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.itemsDetails.productId).toBe(testProductId);
    expect(res.body.data.itemsDetails.quantity).toBe(120);
    expect(res.body.data.itemsDetails.requestedPallets).toBe(2);

    const requestId = res.body.data.id;

    // Approve the request
    const approveRes = await request(app)
      .put(`/api/dispatch/requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(approveRes.status).toBe(200);

    // Finalize dispatch
    const dispatchRes = await request(app)
      .put(`/api/dispatch/requests/${requestId}/dispatch`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.success).toBe(true);

    // Verify inventory is decremented by 120 (200 - 120 = 80)
    const inventory = await prisma.inventory.findUnique({
      where: { id: testInventoryId },
    });
    expect(inventory.quantity).toBe(80);
    expect(inventory.status).toBe('STORED');

    // Verify warehouse occupancy is decremented by requestedPallets (4 - 2 = 2)
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: testWarehouseId },
    });
    expect(warehouse.currentOccupancyPallets).toBe(2);
  });

  it('should change inventory record status to DISPATCHED when completely depleted', async () => {
    // 1. Create a dispatch request for the remaining 80 units
    const res = await request(app)
      .post('/api/dispatch/requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        productId: testProductId,
        quantity: 80,
        warehouseId: testWarehouseId,
        requestedPallets: 2,
      });

    expect(res.status).toBe(201);
    const requestId = res.body.data.id;

    // 2. Approve request
    await request(app)
      .put(`/api/dispatch/requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    // 3. Finalize dispatch
    const dispatchRes = await request(app)
      .put(`/api/dispatch/requests/${requestId}/dispatch`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(dispatchRes.status).toBe(200);

    // 4. Verify inventory is flipped to status DISPATCHED with quantity 0
    const inventory = await prisma.inventory.findUnique({
      where: { id: testInventoryId },
    });
    expect(inventory.quantity).toBe(0);
    expect(inventory.status).toBe('DISPATCHED');

    // 5. Verify warehouse occupancy is decremented (2 - 2 = 0)
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: testWarehouseId },
    });
    expect(warehouse.currentOccupancyPallets).toBe(0);
  });
});
