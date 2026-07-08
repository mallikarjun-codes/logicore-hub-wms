import jwt from 'jsonwebtoken';

/**
 * authenticateJWT
 * Extracts and verifies the Bearer token from the Authorization header.
 * Attaches the decoded payload to req.user for downstream handlers.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const authenticateJWT = (req, res, next) => {
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
    const decoded = jwt.verify(token, secret);
    // Attach the decoded payload directly — standard JS object assignment
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
 *
 * @param {...string} roles - Allowed role strings (e.g. 'SUPER_ADMIN', 'CLIENT')
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
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
 * Returns a Prisma-compatible `where` clause scoped to the requesting tenant.
 *
 * - CLIENT              → { companyId }
 * - WAREHOUSE_MANAGER / WAREHOUSE_STAFF → { warehouseId }
 * - SUPER_ADMIN         → {} (unrestricted)
 *
 * @param {{ role: string, companyId?: string, warehouseId?: string }} user
 * @returns {Record<string, string | undefined>}
 */
export const tenantGuard = (user) => {
  switch (user.role) {
    case 'CLIENT':
      return { companyId: user.companyId ?? undefined };
    case 'WAREHOUSE_MANAGER':
    case 'WAREHOUSE_STAFF':
      return { warehouseId: user.warehouseId ?? undefined };
    case 'SUPER_ADMIN':
    default:
      return {};
  }
};
