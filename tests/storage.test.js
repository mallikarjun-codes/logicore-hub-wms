import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

// Test identities
const ADMIN_EMAIL = 'storage.test.admin@waremind-test.ai';
const MANAGER_EMAIL = 'storage.test.manager@waremind-test.ai';
const STAFF_EMAIL = 'storage.test.staff@waremind-test.ai';
const CLIENT_EMAIL = 'storage.test.client@waremind-test.ai';
const TEST_PASSWORD = 'SecurePass123!';

let adminToken;
let managerToken;
let staffToken;
let clientToken;

let testCompanyId;
let testProductId;
let testWarehouseId;
let testBinId;

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // 1. Create a client company
  const company = await prisma.company.create({
    data: {
      name: 'Storage Test Company',
      gstNumber: `GST-ST-${Date.now()}`,
      address: 'Storage St 101',
      contactEmail: 'logistics@storagetest.com',
      billingPlan: 'BASIC',
      priority: 'LOW',
    },
  });
  testCompanyId = company.id;

  // 2. Create a product for that company
  const product = await prisma.product.create({
    data: {
      sku: `SKU-ST-${Date.now()}`,
      name: 'Storage Test Product',
      category: 'Electronics',
      weight: 1.0,
      dimensions: '10x10x10 cm',
      companyId: testCompanyId,
    },
  });
  testProductId = product.id;

  // 3. Create a warehouse with small capacity (5 pallets) for testing capacity limit
  const warehouse = await prisma.warehouse.create({
    data: {
      name: 'Storage Test Warehouse',
      location: 'Storage City',
      totalCapacityPallets: 5,
      currentOccupancyPallets: 0,
      zones: {
        create: {
          name: 'Zone S',
          racks: {
            create: {
              name: 'Rack S01',
              shelves: {
                create: {
                  name: 'Shelf S1',
                  bins: {
                    create: {
                      name: 'Bin S1',
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

  // 4. Create users
  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Storage Admin',
      role: 'SUPER_ADMIN',
    },
  });

  await prisma.user.create({
    data: {
      email: MANAGER_EMAIL,
      passwordHash,
      name: 'Storage Manager',
      role: 'WAREHOUSE_MANAGER',
      warehouseId: testWarehouseId,
    },
  });

  await prisma.user.create({
    data: {
      email: STAFF_EMAIL,
      passwordHash,
      name: 'Storage Staff',
      role: 'WAREHOUSE_STAFF',
      warehouseId: testWarehouseId,
    },
  });

  await prisma.user.create({
    data: {
      email: CLIENT_EMAIL,
      passwordHash,
      name: 'Storage Client',
      role: 'CLIENT',
      companyId: testCompanyId,
    },
  });

  // 5. Login and retrieve tokens
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
  await prisma.storageRequest.deleteMany({ where: { warehouseId: testWarehouseId } });
  await prisma.product.deleteMany({ where: { companyId: testCompanyId } });
  await prisma.user.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, MANAGER_EMAIL, STAFF_EMAIL, CLIENT_EMAIL] } },
  });
  await prisma.warehouse.deleteMany({ where: { id: testWarehouseId } });
  await prisma.company.deleteMany({ where: { id: testCompanyId } });
  await prisma.$disconnect();
});

describe('Storage Request Workflows', () => {
  let requestId;

  it('should allow CLIENT to create a storage request with status PENDING', async () => {
    const res = await request(app)
      .post('/api/storage/requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        productId: testProductId,
        requestedPallets: 3,
        quantity: 150,
        warehouseId: testWarehouseId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.requestedPallets).toBe(3);
    expect(res.body.data.itemsDetails.productId).toBe(testProductId);
    expect(res.body.data.itemsDetails.quantity).toBe(150);

    requestId = res.body.data.id;
  });

  it('should block non-CLIENT from creating a storage request', async () => {
    const res = await request(app)
      .post('/api/storage/requests')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        productId: testProductId,
        requestedPallets: 2,
        quantity: 100,
        warehouseId: testWarehouseId,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should block WAREHOUSE_STAFF and CLIENT from approving the request', async () => {
    const resStaff = await request(app)
      .put(`/api/storage/requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(resStaff.status).toBe(403);

    const resClient = await request(app)
      .put(`/api/storage/requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(resClient.status).toBe(403);
  });

  it('should allow WAREHOUSE_MANAGER to approve the storage request', async () => {
    const res = await request(app)
      .put(`/api/storage/requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('APPROVED');
  });

  it('should block transition to ARRIVED if requester is not staff/manager/admin', async () => {
    const res = await request(app)
      .put(`/api/storage/requests/${requestId}/arrive`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
  });

  it('should allow WAREHOUSE_STAFF to mark request as ARRIVED', async () => {
    const res = await request(app)
      .put(`/api/storage/requests/${requestId}/arrive`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ARRIVED');
  });

  it('should assert that inventory and capacity are NOT updated yet (Business Rule 4)', async () => {
    // Capacity should still be 0
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: testWarehouseId },
    });
    expect(warehouse.currentOccupancyPallets).toBe(0);

    // No inventory record should exist for this product and bin
    const inventoryCount = await prisma.inventory.count({
      where: {
        productId: testProductId,
        binId: testBinId,
      },
    });
    expect(inventoryCount).toBe(0);
  });

  it('should allow WAREHOUSE_STAFF to finalize by storing in a bin (completing Business Rule 4)', async () => {
    const res = await request(app)
      .put(`/api/storage/requests/${requestId}/store`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ binId: testBinId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify storage request status is updated
    const requestDb = await prisma.storageRequest.findUnique({
      where: { id: requestId },
    });
    expect(requestDb.status).toBe('STORED');

    // Verify warehouse occupancy increased
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: testWarehouseId },
    });
    expect(warehouse.currentOccupancyPallets).toBe(3);

    // Verify inventory record was created
    const inventory = await prisma.inventory.findFirst({
      where: {
        productId: testProductId,
        binId: testBinId,
        status: 'STORED',
      },
    });
    expect(inventory).toBeDefined();
    expect(inventory.quantity).toBe(150);
  });
});

describe('Storage Request Capacity Guard', () => {
  it('should reject storing a request that pushes warehouse over capacity (Capacity Guard Test)', async () => {
    // 1. Create a new storage request for 3 pallets (total capacity is 5, current occupancy is 3, so 3+3=6 > 5)
    const resCreate = await request(app)
      .post('/api/storage/requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        productId: testProductId,
        requestedPallets: 3,
        quantity: 100,
        warehouseId: testWarehouseId,
      });

    expect(resCreate.status).toBe(201);
    const newReqId = resCreate.body.data.id;

    // 2. Transition through workflow to ARRIVED
    await request(app)
      .put(`/api/storage/requests/${newReqId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    await request(app)
      .put(`/api/storage/requests/${newReqId}/arrive`)
      .set('Authorization', `Bearer ${staffToken}`);

    // 3. Finalize storage: should fail with 400 Bad Request
    const resStore = await request(app)
      .put(`/api/storage/requests/${newReqId}/store`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ binId: testBinId });

    expect(resStore.status).toBe(400);
    expect(resStore.body.success).toBe(false);
    expect(resStore.body.message).toMatch(/exceeds the warehouse capacity|capacity/i);

    // 4. Verify request status is still ARRIVED (not STORED)
    const requestDb = await prisma.storageRequest.findUnique({
      where: { id: newReqId },
    });
    expect(requestDb.status).toBe('ARRIVED');

    // 5. Verify warehouse occupancy remained at 3 (did not increase to 6)
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: testWarehouseId },
    });
    expect(warehouse.currentOccupancyPallets).toBe(3);
  });
});
