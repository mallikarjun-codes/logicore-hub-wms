import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import prisma from '../src/config/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Test data — isolated from the main seed; cleaned up after the suite
// ─────────────────────────────────────────────────────────────────────────────
const TEST_EMAIL = 'test.superadmin@waremind-test.ai';
const TEST_PASSWORD = 'SecurePass123!';
const TEST_WRONG_PASSWORD = 'WrongPassword999!';

let testUserId: string;
let validToken: string;

// ─────────────────────────────────────────────────────────────────────────────
// Setup: create a real bcrypt-hashed user before the test suite
// ─────────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      name: 'Test Super Admin',
      role: 'SUPER_ADMIN',
    },
  });

  testUserId = user.id;
});

// ─────────────────────────────────────────────────────────────────────────────
// Teardown: remove the test user so re-runs are safe
// ─────────────────────────────────────────────────────────────────────────────
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth API — POST /api/auth/login', () => {
  it('Test 1: should return 200 + a signed JWT for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(typeof res.body.data.token).toBe('string');

    // Verify the JWT is properly structured and contains the right claims
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(res.body.data.token, secret) as Record<string, unknown>;
    expect(decoded.email).toBe(TEST_EMAIL);
    expect(decoded.role).toBe('SUPER_ADMIN');

    // Stash for later tests
    validToken = res.body.data.token;
  });

  it('Test 2: should return 401 with a generic message for an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_WRONG_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    // Must be the same message as a wrong email to prevent user enumeration
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('Test 2b: should return 401 with the same generic message for a non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: TEST_WRONG_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('Test 2c: should return 400 when email or password fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL }); // missing password

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth API — GET /api/auth/me', () => {
  it('Test 3: should return the user profile for a valid Bearer token', async () => {
    // Ensure we have the token from Test 1
    if (!validToken) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      validToken = loginRes.body.data.token;
    }

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(TEST_EMAIL);
    expect(res.body.data.role).toBe('SUPER_ADMIN');
    // passwordHash must NEVER be returned
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('Test 4a: should return 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('Test 4b: should return 401 when an invalid / tampered token is provided', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer this.is.a.fake.token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('Test 4c: should return 401 when a well-formed token is signed with the wrong secret', async () => {
    const forgeryToken = jwt.sign(
      { userId: testUserId, email: TEST_EMAIL, role: 'SUPER_ADMIN' },
      'completely-wrong-secret'
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${forgeryToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
