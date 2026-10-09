import crypto from 'crypto';
import { prisma } from '../database/client.js';
import { ValidationError } from '../core/exceptions/exceptions.js';

export class IdempotencyService {
  calculateHash(payload: any): string {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async get(key: string): Promise<any | null> {
    return prisma.idempotencyKey.findUnique({
      where: { key },
    });
  }

  async save(
    key: string,
    requestHash: string,
    userId: string,
    responseCode: number,
    responseBody: any,
    ttlMinutes = 1440 // 24 hours default
  ): Promise<any> {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    return prisma.idempotencyKey.create({
      data: {
        key,
        requestHash,
        userId,
        responseCode,
        responseBody: responseBody as any,
        expiresAt,
      },
    });
  }

  async handleRequest(
    key: string,
    payload: any,
    userId: string
  ): Promise<{ shortCircuit: boolean; code?: number; body?: any; hash: string }> {
    const hash = this.calculateHash(payload);
    const existing = await this.get(key);

    if (existing) {
      if (existing.requestHash !== hash) {
        throw new ValidationError('Idempotency key already exists with a different request payload');
      }
      return {
        shortCircuit: true,
        code: existing.responseCode,
        body: existing.responseBody,
        hash,
      };
    }

    return {
      shortCircuit: false,
      hash,
    };
  }
}

export const idempotencyService = new IdempotencyService();
