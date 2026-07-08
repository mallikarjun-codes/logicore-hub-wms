/**
 * Global Express Request augmentation.
 * Adds the `user` property populated by authenticateJWT middleware.
 * Role is kept as `string` (not the Prisma enum) to avoid a circular
 * dependency between this ambient declaration file and the generated
 * Prisma client. Runtime values are always valid Role enum members.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
        companyId: string | null;
        warehouseId: string | null;
      };
    }
  }
}

export {};
