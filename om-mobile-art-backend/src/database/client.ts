import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../services/logger.js';

const isDevelopment = env.NODE_ENV === 'development';

export const prisma = new PrismaClient({
  log: isDevelopment 
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ]
    : [{ emit: 'stdout', level: 'error' }],
});

if (isDevelopment) {
  (prisma as any).$on('query', (e: any) => {
    logger.debug({
      msg: 'Database Query executed',
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}
