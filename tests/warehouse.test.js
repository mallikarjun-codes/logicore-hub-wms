import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test identities
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'wh.test.admin@waremind-test.ai';
const MANAGER_EMAIL = 'wh.test.manager@waremind-test.ai';
const CLIENT_EMAIL = 'wh.test.client@waremind-test.ai';
const TEST_PASSWORD = 'SecurePass123!';

let adminToken;
let managerToken;
let clientToken;
let testWarehouseId;
let testCompanyId;

// ─────────────────────────────────────────────────────────────────────────────
// Setup — creates a complete warehouse tree and users
// ─────────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // Create a client company for tenant scoping tests
  const company = await prisma.company.create({
    data: {
      name: 'WH Test Company',
      gstNumber: 'WHTEST9999999999ABC',
      address: 'Test Warehouse St',
      contactEmail: 'wh@testco.com',
      billingPlan: 'BASIC',
      priority: 'LOW',
    },
  });
  testCompanyId = company.id;

  // Create a warehouse with a full Zone → Rack → Shelf → Bin hierarchy
  const warehouse = await prisma.warehouse.create({
    data: {
      name: 'Test Warehouse Alpha',
      location: 'Test City',
      totalCapacityPallets: 500,
      currentOccupancyPallets: 10,
      zones: {
        create: [
          {
            name: 'Zone X',
            racks: {
              create: [
                {
                  name: 'Rack X01',
                  // This rack is unallocated
                  shelves: {
                    create: [
                      {
                        name: 'Shelf 1',
                        bins: { create: [{ name: 'Bin 1' }, { name: 'Bin 2' }] },
                      },
                    ],
                  },
                },
                {
                  name: 'Rack X02',
                  // This rack is allocated to the test company
                  currentCompanyId: company.id,
                  shelves: {
                    create: [
                      {
                        name: 'Shelf 1',
                        bins: { create: [{ name: 'Bin 1' }] },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    select: { id: true },
  });
  testWarehouseId = warehouse.id;

  // Create users
  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'WH Test Admin',
      role: 'SUPER_ADMIN',
    },
  });
  await prisma.user.create({
    data: {
      email: MANAGER_EMAIL,
      passwordHash,
      name: 'WH Test Manager',
      role: 'WAREHOUSE_MANAGER',
      warehouseId: testWarehouseId,
    },
  });
  await prisma.user.create({
    data: {
      email: CLIENT_EMAIL,
      passwordHash,
      name: 'WH Test Client',
      role: 'CLIENT',
      companyId: testCompanyId,
    },
  });

  // Login all users
  const [adminRes, managerRes, clientRes] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: TEST_PASSWORD }),
    request(app).post('/api/auth/login').send({ email: MANAGER_EMAIL, password: TEST_PASSWORD }),
    request(app).post('/api/auth/login').send({ email: CLIENT_EMAIL, password: TEST_PASSWORD }),
  ]);

  adminToken = adminRes.body.data.token;
  managerToken = managerRes.body.data.token;
  clientToken = clientRes.body.data.token;
});

// ─────────────────────────────────────────────────────────────────────────────
// Teardown
// ─────────────────────────────────────────────────────────────────────────────
afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, MANAGER_EMAIL, CLIENT_EMAIL] } },
  });
  await prisma.warehouse.deleteMany({ where: { id: testWarehouseId } });
  await prisma.company.deleteMany({ where: { id: testCompanyId } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Warehouse API — GET /api/warehouses', () => {
  it('SUPER_ADMIN should get a list of all warehouses', async () => {
    const res = await request(app)
      .get('/api/warehouses')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const found = res.body.data.find((w) => w.id === testWarehouseId);
    expect(found).toBeDefined();
    expect(found).toHaveProperty('totalCapacityPallets');
    expect(found).toHaveProperty('currentOccupancyPallets');
  });

  it('WAREHOUSE_MANAGER should see only their assigned warehouse', async () => {
    const res = await request(app)
      .get('/api/warehouses')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Single object returned (not an array) for warehouse personnel
    expect(res.body.data.id).toBe(testWarehouseId);
  });

  it('CLIENT should be blocked with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/warehouses')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('unauthenticated request should return 401', async () => {
    const res = await request(app).get('/api/warehouses');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Warehouse API — GET /api/warehouses/:id/grid', () => {
  it('should return the full Zone → Rack → Shelf → Bin hierarchy', async () => {
    const res = await request(app)
      .get(`/api/warehouses/${testWarehouseId}/grid`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const grid = res.body.data;
    expect(grid.id).toBe(testWarehouseId);
    expect(Array.isArray(grid.zones)).toBe(true);
    expect(grid.zones.length).toBeGreaterThanOrEqual(1);

    const zone = grid.zones[0];
    expect(zone).toHaveProperty('racks');
    expect(Array.isArray(zone.racks)).toBe(true);

    const rack = zone.racks[0];
    expect(rack).toHaveProperty('shelves');
    expect(Array.isArray(rack.shelves)).toBe(true);

    const shelf = rack.shelves[0];
    expect(shelf).toHaveProperty('bins');
    expect(Array.isArray(shelf.bins)).toBe(true);

    // Each bin must expose its inventories array
    const bin = shelf.bins[0];
    expect(bin).toHaveProperty('inventories');
    expect(Array.isArray(bin.inventories)).toBe(true);
  });

  it('WAREHOUSE_MANAGER should access their own warehouse grid', async () => {
    const res = await request(app)
      .get(`/api/warehouses/${testWarehouseId}/grid`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(testWarehouseId);
  });

  it('should return 404 for a non-existent warehouse ID', async () => {
    const res = await request(app)
      .get('/api/warehouses/00000000-0000-0000-0000-000000000000/grid')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Warehouse API — GET /api/warehouses/racks/available', () => {
  it('CLIENT should see unallocated racks AND racks belonging to their company', async () => {
    const res = await request(app)
      .get('/api/warehouses/racks/available')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Should include the unallocated rack (Rack X01) and the company's rack (Rack X02)
    const rackNames = res.body.data.map((r) => r.name);
    expect(rackNames).toContain('Rack X01');
    expect(rackNames).toContain('Rack X02');

    // Verify the zone + warehouse data is nested correctly
    const rack = res.body.data[0];
    expect(rack).toHaveProperty('zone');
    expect(rack.zone).toHaveProperty('warehouse');
  });

  it('SUPER_ADMIN should see only unallocated racks', async () => {
    const res = await request(app)
      .get('/api/warehouses/racks/available')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Every returned rack must be unallocated
    for (const rack of res.body.data) {
      expect(rack.currentCompanyId).toBeNull();
    }
  });

  it('WAREHOUSE_MANAGER should be blocked with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/warehouses/racks/available')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
