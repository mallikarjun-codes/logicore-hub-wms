import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

/**
 * POST /api/auth/login
 * Validates credentials, checks bcrypt hash, returns a signed JWT.
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({
        success: false,
        message: 'Server misconfiguration: JWT_SECRET is not defined.',
      });
      return;
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      warehouseId: user.warehouseId,
    };

    const token = jwt.sign(payload, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
    });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          warehouseId: user.warehouseId,
        },
      },
    });
  } catch (error) {
    console.error('[AUTH] login error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred during login.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * POST /api/auth/register
 * Creates a new user account. Password is hashed before storage.
 * Accepts: name, email, password, role, companyId (optional), warehouseId (optional).
 *
 * Roles that require companyId  : CLIENT
 * Roles that require warehouseId: WAREHOUSE_MANAGER, WAREHOUSE_STAFF
 * Roles with no tenant link     : SUPER_ADMIN
 */
export const register = async (req, res) => {
  try {
    const { name, email, password, role, companyId, warehouseId } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!name || !email || !password || !role) {
      res.status(400).json({
        success: false,
        message: 'name, email, password, and role are all required.',
      });
      return;
    }

    const VALID_ROLES = ['SUPER_ADMIN', 'CLIENT', 'WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF'];
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.`,
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Unique email check ────────────────────────────────────────────────────
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: 'An account with that email address already exists.',
      });
      return;
    }

    // ── Hash password ─────────────────────────────────────────────────────────
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // ── Build the create payload with tenant scoping ──────────────────────────
    const createData = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
    };

    if (role === 'CLIENT' && companyId) {
      createData.companyId = companyId;
    }

    if ((role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE_STAFF') && warehouseId) {
      createData.warehouseId = warehouseId;
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    const newUser = await prisma.user.create({
      data: createData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        warehouseId: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully. You may now log in.',
      data: newUser,
    });
  } catch (error) {
    console.error('[AUTH] register error:', error);

    // Prisma unique constraint fallback (P2002)
    if (error.code === 'P2002') {
      res.status(400).json({
        success: false,
        message: 'An account with that email address already exists.',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'An internal server error occurred during registration.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * GET /api/auth/me
 * Returns the profile of the currently authenticated user (no passwordHash).
 */
export const getMe = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        warehouseId: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true,
            billingPlan: true,
            priority: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User account not found. It may have been deleted.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('[AUTH] getMe error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
