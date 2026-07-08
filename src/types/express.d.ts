import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: Role;
        companyId: string | null;
        warehouseId: string | null;
      };
    }
  }
}

export {};
