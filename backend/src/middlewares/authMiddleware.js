import jwt from 'jsonwebtoken';

/**
 * authenticateJWT
 * Extracts and verifies the Bearer token from the Authorization header.
 * Attaches the decoded payload to req.user for downstream handlers.
 */
export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // ── Diagnostic log — remove once token issues are resolved ──────────────────
  console.log('[AUTH] Authorization header received:', authHeader
    ? `"${authHeader.substring(0, 40)}..."` : 'MISSING');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
    return;
  }

  // Split on the single space after "Bearer" — trim to handle any stray whitespace
  const rawToken = authHeader.split(' ')[1]?.trim();

  // Guard: reject if the token string is wrapped in literal quote characters
  // (this happens when localStorage returns a JSON-stringified value).
  const token = rawToken?.startsWith('"') && rawToken?.endsWith('"')
    ? rawToken.slice(1, -1)
    : rawToken;

  console.log('[AUTH] Token extracted (first 20 chars):', token ? token.substring(0, 20) : 'NONE');

  const secret = process.env.JWT_SECRET;
  console.log('[AUTH] JWT_SECRET present:', !!secret);

  if (!secret) {
    res.status(500).json({
      success: false,
      message: 'Server misconfiguration: JWT_SECRET is not defined.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('[AUTH] jwt.verify failed:', error.message);
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token has expired. Please log in again.' });
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
 * req.user.role is one of the permitted roles for the route.
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
