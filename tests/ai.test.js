import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

// Setup Vitest Hoisted Mocks for the Gemini SDK
const { mockGenerateContent } = vi.hoisted(() => {
  return {
    mockGenerateContent: vi.fn().mockResolvedValue({
      text: 'Mocked AI Analyst Response',
    }),
  };
});

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    })),
  };
});

// Test identities
const ADMIN_EMAIL = 'ai.test.admin@waremind-test.ai';
const CLIENT_A_EMAIL = 'ai.test.clienta@waremind-test.ai';
const CLIENT_B_EMAIL = 'ai.test.clientb@waremind-test.ai';
const TEST_PASSWORD = 'SecurePass123!';

let adminToken;
let clientAToken;
let clientBToken;

let companyAId;
let companyBId;
let clientAUserId;
let clientBUserId;

let skuA = `SKU-AI-A-${Date.now()}`;
let skuB = `SKU-AI-B-${Date.now()}`;

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // 1. Create two separate client companies
  const companyA = await prisma.company.create({
    data: {
      name: 'AI Test Company A',
      gstNumber: `GST-AI-A-${Date.now()}`,
      address: 'AI Road 1',
      contactEmail: 'a@aitestco.com',
      billingPlan: 'BASIC',
      priority: 'LOW',
    },
  });
  companyAId = companyA.id;

  const companyB = await prisma.company.create({
    data: {
      name: 'AI Test Company B',
      gstNumber: `GST-AI-B-${Date.now()}`,
      address: 'AI Road 2',
      contactEmail: 'b@aitestco.com',
      billingPlan: 'BASIC',
      priority: 'LOW',
    },
  });
  companyBId = companyB.id;

  // 2. Create products under each company
  await prisma.product.create({
    data: {
      sku: skuA,
      name: 'Product A (Company A Only)',
      category: 'Electronics',
      weight: 1.0,
      dimensions: '10x10x10 cm',
      companyId: companyAId,
    },
  });

  await prisma.product.create({
    data: {
      sku: skuB,
      name: 'Product B (Company B Only)',
      category: 'Clothing',
      weight: 0.5,
      dimensions: '5x5x5 cm',
      companyId: companyBId,
    },
  });

  // 3. Create users
  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'AI Admin',
      role: 'SUPER_ADMIN',
    },
  });

  const clientA = await prisma.user.create({
    data: {
      email: CLIENT_A_EMAIL,
      passwordHash,
      name: 'Client A User',
      role: 'CLIENT',
      companyId: companyAId,
    },
  });
  clientAUserId = clientA.id;

  const clientB = await prisma.user.create({
    data: {
      email: CLIENT_B_EMAIL,
      passwordHash,
      name: 'Client B User',
      role: 'CLIENT',
      companyId: companyBId,
    },
  });
  clientBUserId = clientB.id;

  // 4. Retrieve login tokens
  const login = async (email) => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    return res.body.data.token;
  };

  adminToken = await login(ADMIN_EMAIL);
  clientAToken = await login(CLIENT_A_EMAIL);
  clientBToken = await login(CLIENT_B_EMAIL);
});

afterAll(async () => {
  // Clean up chat logs and setup data
  await prisma.aIChatHistory.deleteMany({
    where: { userId: { in: [clientAUserId, clientBUserId] } },
  });
  await prisma.product.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
  await prisma.user.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, CLIENT_A_EMAIL, CLIENT_B_EMAIL] } },
  });
  await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
  await prisma.$disconnect();
});

describe('AI Copilot API — POST /api/ai/copilot', () => {
  it('should ensure a CLIENT cannot query data outside their multi-tenant company bounds (AI Test 1)', async () => {
    // Client A queries AI copilot on inventory
    const res = await request(app)
      .post('/api/ai/copilot')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({
        message: 'List my items',
        contextPage: 'inventory',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.response).toBe('Mocked AI Analyst Response');

    // Verify mock invocation details to check tenant isolation
    expect(mockGenerateContent).toHaveBeenCalled();
    const calls = mockGenerateContent.mock.calls;
    const lastCallConfig = calls[calls.length - 1][0];

    // Assert that Company A's product (skuA) is passed in the context
    expect(lastCallConfig.config.systemInstruction).toContain(skuA);
    // Assert that Company B's product (skuB) is NOT leaked in the context
    expect(lastCallConfig.config.systemInstruction).not.toContain(skuB);
  });

  it('should verify that hitting the endpoint creates a persistent trail inside the AIChatHistory table (AI Test 2)', async () => {
    const messageText = 'Billing health check';
    
    const res = await request(app)
      .post('/api/ai/copilot')
      .set('Authorization', `Bearer ${clientBToken}`)
      .send({
        message: messageText,
        contextPage: 'billing',
      });

    expect(res.status).toBe(200);
    const historyId = res.body.data.historyId;
    expect(historyId).toBeDefined();

    // Query database to ensure record is persisted correctly
    const historyRecord = await prisma.aIChatHistory.findUnique({
      where: { id: historyId },
    });

    expect(historyRecord).toBeDefined();
    expect(historyRecord.userId).toBe(clientBUserId);
    expect(historyRecord.contextPage).toBe('billing');
    expect(historyRecord.message).toBe(messageText);
    expect(historyRecord.response).toBe('Mocked AI Analyst Response');
  });

  it('should reject requests with missing message or contextPage parameters', async () => {
    const res = await request(app)
      .post('/api/ai/copilot')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({
        message: 'No page context',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
