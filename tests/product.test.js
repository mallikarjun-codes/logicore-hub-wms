import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test identities
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'prod.test.admin@waremind-test.ai';
const CLIENT_A_EMAIL = 'prod.test.clienta@waremind-test.ai';
const CLIENT_B_EMAIL = 'prod.test.clientb@waremind-test.ai';
const MANAGER_EMAIL = 'prod.test.manager@waremind-test.ai';
const TEST_PASSWORD = 'SecurePass123!';

const SKU_A = `TEST-SKU-ALPHA-${Date.now()}`;
const SKU_B = `TEST-SKU-BETA-${Date.now()}`;
const SKU_LOCKED = `TEST-SKU-LOCKED-${Date.now()}`;
const SKU_DUPE = SKU_A; // used to test duplicate prevention

let adminToken;
let clientAToken;
let clientBToken;
let managerToken;

let companyAId;
let companyBId;
let testWarehouseId;

let productAId;      // Company A's product (no inventory)
let lockedProductId; // Company A's product (has active inventory — cannot be deleted)

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // Create two separate client companies
  const companyA = await prisma.company.create({
    data: {
      name: 'Product Test Company A',
      gstNumber: `PROD-A-GST-${Date.now()}`,
      address: 'Company A HQ',
      contactEmail: 'a@prodtest.com',
      billingPlan: 'BASIC',
      priority: 'LOW',
    },
  });
  companyAId = companyA.id;

  const companyB = await prisma.company.create({
    data: {
      name: 'Product Test Company B',
      gstNumber: `PROD-B-GST-${Date.now()}`,
      address: 'Company B HQ',
      contactEmail: 'b@prodtest.com',
      billingPlan: 'BASIC',
      priority: 'LOW',
    },
  });
  companyBId = companyB.id;

  // Create a warehouse for the manager and for inventory records
  const warehouse = await prisma.warehouse.create({
    data: {
      name: 'Product Test Warehouse',
      location: 'Product Test City',
      totalCapacityPallets: 200,
      zones: {
        create: {
          name: 'Zone P',
          racks: {
            create: {
              name: 'Rack P01',
              shelves: {
                create: {
                  name: 'Shelf P1',
                  bins: { create: [{ name: 'Bin P1' }, { name: 'Bin P2' }] },
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
  testWarehouseId = warehouse.id;

  const binP1Id = warehouse.zones[0].racks[0].shelves[0].bins[0].id;

  // Create users
  await prisma.user.create({ data: { email: ADMIN_EMAIL, passwordHash, name: 'Prod Admin', role: 'SUPER_ADMIN' } });
  await prisma.user.create({ data: { email: CLIENT_A_EMAIL, passwordHash, name: 'Client A', role: 'CLIENT', companyId: companyAId } });
  await prisma.user.create({ data: { email: CLIENT_B_EMAIL, passwordHash, name: 'Client B', role: 'CLIENT', companyId: companyBId } });
  await prisma.user.create({ data: { email: MANAGER_EMAIL, passwordHash, name: 'Prod Manager', role: 'WAREHOUSE_MANAGER', warehouseId: testWarehouseId } });

  // Create a product for Company A that has NO inventory (safe to delete)
  const productA = await prisma.product.create({
    data: {
      sku: SKU_A,
      name: 'Product Alpha (no inventory)',
      category: 'Electronics',
      weight: 0.5,
      dimensions: '10x5x3 cm',
      companyId: companyAId,
    },
  });
  productAId = productA.id;

  // Create a product for Company A that HAS active inventory (delete blocked)
  const lockedProduct = await prisma.product.create({
    data: {
      sku: SKU_LOCKED,
      name: 'Locked Product (has inventory)',
      category: 'Electronics',
      weight: 1.0,
      dimensions: '20x10x5 cm',
      companyId: companyAId,
    },
  });
  lockedProductId = lockedProduct.id;

  await prisma.inventory.create({
    data: {
      quantity: 100,
      arrivalDate: new Date(),
      status: 'STORED',
      productId: lockedProduct.id,
      companyId: companyAId,
      warehouseId: testWarehouseId,
      binId: binP1Id,
    },
  });

  // Create a product for Company B (used to test cross-tenant isolation)
  await prisma.product.create({
    data: {
      sku: SKU_B,
      name: 'Product Beta (company B)',
      category: 'Furniture',
      weight: 5.0,
      dimensions: '50x40x30 cm',
      companyId: companyBId,
    },
  });

  // Login all users — sequential so errors are easy to diagnose
  const loginAndExtract = async (email) => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    if (!res.body?.data?.token) {
      throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
    }
    return res.body.data.token;
  };

  adminToken   = await loginAndExtract(ADMIN_EMAIL);
  clientAToken = await loginAndExtract(CLIENT_A_EMAIL);
  clientBToken = await loginAndExtract(CLIENT_B_EMAIL);
  managerToken = await loginAndExtract(MANAGER_EMAIL);

});

// ─────────────────────────────────────────────────────────────────────────────
// Teardown — FK-safe order
// ─────────────────────────────────────────────────────────────────────────────
afterAll(async () => {
  await prisma.inventory.deleteMany({ where: { warehouseId: testWarehouseId } });
  await prisma.product.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
  await prisma.warehouse.deleteMany({ where: { id: testWarehouseId } });
  await prisma.user.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, CLIENT_A_EMAIL, CLIENT_B_EMAIL, MANAGER_EMAIL] } },
  });
  await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Product API — POST /api/products', () => {
  it('CLIENT should create a product auto-bound to their companyId', async () => {
    const sku = `CLIENT-CREATE-${Date.now()}`;
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({
        sku,
        name: 'Client Created Product',
        category: 'Gadgets',
        weight: 0.3,
        dimensions: '5x5x2 cm',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.companyId).toBe(companyAId);
    expect(res.body.data.sku).toBe(sku);

    // Cleanup this ad-hoc product
    await prisma.product.delete({ where: { id: res.body.data.id } });
  });

  it('SUPER_ADMIN should create a product with explicit companyId', async () => {
    const sku = `ADMIN-CREATE-${Date.now()}`;
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku,
        name: 'Admin Created Product',
        category: 'Tools',
        weight: 2.0,
        dimensions: '30x20x10 cm',
        companyId: companyBId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.companyId).toBe(companyBId);

    await prisma.product.delete({ where: { id: res.body.data.id } });
  });

  it('should return 400 for a duplicate SKU', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({
        sku: SKU_DUPE, // same as SKU_A, already exists
        name: 'Duplicate SKU Product',
        category: 'Electronics',
        weight: 0.5,
        dimensions: '10x5x3 cm',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({ name: 'Missing SKU Product' }); // no sku, category, weight, dimensions

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Product API — GET /api/products (tenant isolation)', () => {
  it('CLIENT A should only see their own company products — not Company B products', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${clientAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    // All returned products must belong to Company A
    for (const product of res.body.data) {
      expect(product.companyId).toBe(companyAId);
    }

    // Company B's product (SKU_B) must NOT appear
    const skus = res.body.data.map((p) => p.sku);
    expect(skus).not.toContain(SKU_B);
  });

  it('CLIENT B should only see their own company products — not Company A products', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${clientBToken}`);

    expect(res.status).toBe(200);
    for (const product of res.body.data) {
      expect(product.companyId).toBe(companyBId);
    }

    const skus = res.body.data.map((p) => p.sku);
    expect(skus).not.toContain(SKU_A);
  });

  it('WAREHOUSE_MANAGER should see products with active inventory in their warehouse', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The locked product has active inventory in this warehouse
    const ids = res.body.data.map((p) => p.id);
    expect(ids).toContain(lockedProductId);
  });

  it('SUPER_ADMIN should see all products', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const skus = res.body.data.map((p) => p.sku);
    expect(skus).toContain(SKU_A);
    expect(skus).toContain(SKU_B);
    expect(skus).toContain(SKU_LOCKED);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Product API — DELETE /api/products/:id', () => {
  it('should return 400 when deleting a product with active inventory', async () => {
    const res = await request(app)
      .delete(`/api/products/${lockedProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/active inventory/i);
  });

  it('CLIENT A should not be able to delete Company B products (403)', async () => {
    // Fetch Company B's product id
    const companyBProducts = await prisma.product.findMany({ where: { companyId: companyBId } });
    const companyBProductId = companyBProducts[0].id;

    const res = await request(app)
      .delete(`/api/products/${companyBProductId}`)
      .set('Authorization', `Bearer ${clientAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should successfully delete a product with no active inventory', async () => {
    const res = await request(app)
      .delete(`/api/products/${productAId}`)
      .set('Authorization', `Bearer ${clientAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/permanently deleted/i);

    // Verify it's gone
    const gone = await prisma.product.findUnique({ where: { id: productAId } });
    expect(gone).toBeNull();
  });

  it('should return 404 for a non-existent product ID', async () => {
    const res = await request(app)
      .delete('/api/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
