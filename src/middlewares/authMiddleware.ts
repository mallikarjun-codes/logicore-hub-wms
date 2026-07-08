import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  companyId: string | null;
  warehouseId: string | null;
}

/**
 * authenticateJWT
 * Extracts and verifies the Bearer token from the Authorization header.
 * Attaches the decoded payload to req.user for downstream handlers.
 */
export const authenticateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({
      success: false,
      message: 'Server misconfiguration: JWT_SECRET is not defined.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token has expired.' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, message: 'Invalid token.' });
      return;
    }
    res.status(500).json({ success: false, message: 'Token verification failed.' });
  }
};

/**
 * authorizeRoles
 * Higher-order middleware factory. Returns a middleware that checks whether
 * req.user.role is one of the permitted roles for the route. Returns 403 if not.
 */
export const authorizeRoles = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access forbidden. Required roles: [${roles.join(', ')}]. Your role: ${req.user.role}.`,
      });
      return;
    }

    next();
  };
};

/**
 * tenantGuard
 * Structural enforcement utility — NOT a middleware itself, but a helper
 * used *inside* controllers to derive the correct tenant-scoped WHERE clause.
 *
 * - CLIENT role   → scopes by companyId
 * - WAREHOUSE_MANAGER / WAREHOUSE_STAFF → scopes by warehouseId
 * - SUPER_ADMIN → no restriction (returns empty object so all records are returned)
 *
 * Usage inside a controller:
 *   const scope = tenantGuard(req.user!);
 *   const records = await prisma.inventory.findMany({ where: scope });
 */
export const tenantGuard = (
  user: NonNullable<Request['user']>
): Record<string, string | undefined> => {
  switch (user.role) {
    case Role.CLIENT:
      return { companyId: user.companyId ?? undefined };
    case Role.WAREHOUSE_MANAGER:
    case Role.WAREHOUSE_STAFF:
      return { warehouseId: user.warehouseId ?? undefined };
    case Role.SUPER_ADMIN:
    default:
      return {};
  }
};
