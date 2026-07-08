import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test-owned users — separate from seed data, cleaned up after suite
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'company.test.admin@waremind-test.ai';
const CLIENT_EMAIL = 'company.test.client@waremind-test.ai';
const TEST_PASSWORD = 'SecurePass123!';

// GST numbers used in tests — all unique to avoid conflicts with seed data
const NEW_COMPANY_GST = 'TEST29AABCU9900R1ZX';
const BLOCKED_COMPANY_GST = 'TEST29AADCB1111M1Z0';
const DUPLICATE_GST = 'TEST29AABCU9900R1ZX'; // same as NEW_COMPANY_GST, used in Test 3

let adminToken;
let clientToken;
let createdCompanyId;
let inventoryLockedCompanyId;

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // Create a SUPER_ADMIN for authorized requests
  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Company Test Admin',
      role: 'SUPER_ADMIN',
    },
  });

  // Create a CLIENT user for forbidden-access tests
  // CLIENT users must belong to a company — create a dummy company for them
  const dummyCompany = await prisma.company.create({
    data: {
      name: 'Dummy Test Company',
      gstNumber: 'DUMMY1234567890XYZ',
      address: 'Test Address',
      contactEmail: 'dummy@test.com',
      billingPlan: 'BASIC',
      priority: 'LOW',
    },
  });

  await prisma.user.create({
    data: {
      email: CLIENT_EMAIL,
      passwordHash,
      name: 'Company Test Client',
      role: 'CLIENT',
      companyId: dummyCompany.id,
    },
  });

  // Create a company that will have active inventory (used in Test 4)
  const lockedCompany = await prisma.company.create({
    data: {
      name: 'Inventory Locked Co',
      gstNumber: BLOCKED_COMPANY_GST,
      address: 'Locked Street',
      contactEmail: 'locked@test.com',
      billingPlan: 'BASIC',
      priority: 'LOW',
    },
  });
  inventoryLockedCompanyId = lockedCompany.id;

  // Attach active inventory to that company so deletion is blocked
  // We need a warehouse and a bin for the inventory record
  const warehouse = await prisma.warehouse.create({
    data: {
      name: 'Test Warehouse for Inventory Lock',
      location: 'Test City',
      totalCapacityPallets: 100,
      zones: {
        create: {
          name: 'Zone T',
          racks: {
            create: {
              name: 'Rack T01',
              shelves: {
                create: {
                  name: 'Shelf T1',
                  bins: {
                    create: { name: 'Bin T1' },
                  },
                },
              },
            },
          },
        },
      },
    },
    include: {
      zones: { include: { racks: { include: { shelves: { include: { bins: true } } } } } },
    },
  });

  const binId = warehouse.zones[0].racks[0].shelves[0].bins[0].id;

  const product = await prisma.product.create({
    data: {
      sku: `TEST-LOCK-SKU-${Date.now()}`,
      name: 'Locked Product',
      category: 'Test',
      weight: 1.0,
      dimensions: '10x10x10',
      companyId: lockedCompany.id,
    },
  });

  await prisma.inventory.create({
    data: {
      quantity: 50,
      arrivalDate: new Date(),
      status: 'STORED',
      productId: product.id,
      companyId: lockedCompany.id,
      warehouseId: warehouse.id,
      binId,
    },
  });

  // Log in as SUPER_ADMIN
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: TEST_PASSWORD });
  adminToken = adminRes.body.data.token;

  // Log in as CLIENT
  const clientRes = await request(app)
    .post('/api/auth/login')
    .send({ email: CLIENT_EMAIL, password: TEST_PASSWORD });
  clientToken = clientRes.body.data.token;
});

// ─────────────────────────────────────────────────────────────────────────────
// Teardown — delete in FK-safe order
// ─────────────────────────────────────────────────────────────────────────────
afterAll(async () => {
  // Delete any company created during the tests
  await prisma.inventory.deleteMany({
    where: { companyId: inventoryLockedCompanyId },
  });
  await prisma.product.deleteMany({
    where: { companyId: inventoryLockedCompanyId },
  });
  await prisma.warehouse.deleteMany({
    where: { name: 'Test Warehouse for Inventory Lock' },
  });

  // Remove companies — this cascades to racks etc. per schema
  const gstNumbersToClean = [
    NEW_COMPANY_GST,
    BLOCKED_COMPANY_GST,
    'DUMMY1234567890XYZ',
  ];
  await prisma.company.deleteMany({
    where: { gstNumber: { in: gstNumbersToClean } },
  });

  if (createdCompanyId) {
    await prisma.company.deleteMany({ where: { id: createdCompanyId } });
  }

  await prisma.user.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, CLIENT_EMAIL] } },
  });

  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Company API — POST /api/companies', () => {
  it('Test 1: SUPER_ADMIN should create a new company and return 201', async () => {
    const res = await request(app)
      .post('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Vitest Test Company',
        gstNumber: NEW_COMPANY_GST,
        address: '42 Test Lane, Mumbai',
        contactEmail: 'vitest@testco.com',
        billingPlan: 'PROFESSIONAL',
        priority: 'MEDIUM',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Vitest Test Company');
    expect(res.body.data.gstNumber).toBe(NEW_COMPANY_GST);
    expect(res.body.data).toHaveProperty('id');

    createdCompanyId = res.body.data.id;
  });

  it('Test 2: CLIENT role should be blocked with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/companies')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        name: 'Unauthorised Attempt Co',
        gstNumber: 'UNAUTH9876543210ABC',
        address: 'Hack Street',
        contactEmail: 'hack@attempt.com',
        billingPlan: 'FREE',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/forbidden/i);
  });

  it('Test 2b: unauthenticated request (no token) should return 401', async () => {
    const res = await request(app)
      .post('/api/companies')
      .send({
        name: 'No Token Co',
        gstNumber: 'NOTOKEN1234567890AB',
        billingPlan: 'FREE',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('Test 3: should return 400 when creating a company with a duplicate GST number', async () => {
    // DUPLICATE_GST === NEW_COMPANY_GST, already created in Test 1
    const res = await request(app)
      .post('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Duplicate GST Company',
        gstNumber: DUPLICATE_GST,
        address: 'Same GST Lane',
        contactEmail: 'dupe@gst.com',
        billingPlan: 'BASIC',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('Test 3b: should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Incomplete Company',
        // missing gstNumber, address, contactEmail, billingPlan
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Company API — GET /api/companies', () => {
  it('should return an array of companies with _count aggregations for SUPER_ADMIN', async () => {
    const res = await request(app)
      .get('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');

    // Every returned company must have count fields
    for (const company of res.body.data) {
      expect(company._count).toBeDefined();
      expect(company._count).toHaveProperty('inventories');
      expect(company._count).toHaveProperty('storageRequests');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Company API — DELETE /api/companies/:id', () => {
  it('Test 4: should return 400 when deleting a company that has active inventory', async () => {
    const res = await request(app)
      .delete(`/api/companies/${inventoryLockedCompanyId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/active inventory/i);
  });

  it('should successfully delete a company with no active inventory', async () => {
    // createdCompanyId was created in Test 1 and has no inventory
    const res = await request(app)
      .delete(`/api/companies/${createdCompanyId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/permanently deleted/i);

    // Nullify so afterAll doesn't double-delete
    createdCompanyId = '';
  });

  it('should return 404 for a non-existent company ID', async () => {
    const res = await request(app)
      .delete('/api/companies/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
