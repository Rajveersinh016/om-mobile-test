import { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '@prisma/client';
import { ForbiddenError } from '../core/exceptions/exceptions.js';

export const authorize = (...allowedRoles: Role[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    
    if (!user) {
      throw new ForbiddenError('Access denied: User not authenticated');
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError('Access denied: Insufficient permissions');
    }
  };
};
