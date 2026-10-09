import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../core/exceptions/exceptions.js';
import { logger } from '../services/logger.js';
import { SecurityLogger } from '../services/securityLogger.js';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const requestId = request.id;
  const ipAddress = request.ip;
  const route = request.url;
  const user = request.user;
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Handle Rate Limit Violations (HTTP 429)
  if (reply.statusCode === 429 || error.statusCode === 429) {
    SecurityLogger.log({
      action: 'RATE_LIMIT_EXCEEDED',
      severity: 'WARN',
      ipAddress,
      userId: user?.id,
      route,
      statusCode: 429,
      details: 'Client exceeded rate limit threshold',
    });

    reply.header('Retry-After', '60');
    return reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again in a minute.',
        requestId,
      },
    });
  }

  // 2. Handle Custom Application Errors (AppError)
  if (error instanceof AppError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      SecurityLogger.log({
        action: error.statusCode === 401 ? 'UNAUTHORIZED_ACCESS_ATTEMPT' : 'FORBIDDEN_RESOURCE_ATTEMPT',
        severity: 'WARN',
        ipAddress,
        userId: user?.id,
        route,
        statusCode: error.statusCode,
        details: error.message,
      });
    } else {
      logger.warn({
        msg: 'Operational error caught',
        err: error.message,
        errorCode: error.errorCode,
        statusCode: error.statusCode,
        requestId,
      });
    }

    return reply.status(error.statusCode).send({
      success: false,
      message: error.message,
      error: {
        code: error.errorCode,
        message: error.message,
        requestId,
        details: error.details,
      },
    });
  }

  // 3. Handle Prisma Known Errors (Database protection)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error({
      msg: 'Prisma Known Database Error',
      code: error.code,
      meta: error.meta,
      requestId,
    });

    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[])?.join(', ') || 'field';
      const msg = `A record with this ${target} already exists.`;
      return reply.status(409).send({
        success: false,
        message: msg,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: msg,
          requestId,
        },
      });
    }

    if (error.code === 'P2025') {
      const msg = 'Requested record was not found.';
      return reply.status(404).send({
        success: false,
        message: msg,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: msg,
          requestId,
        },
      });
    }

    const dbMsg = 'Invalid database operation request.';
    return reply.status(400).send({
      success: false,
      message: dbMsg,
      error: {
        code: 'DATABASE_ERROR',
        message: dbMsg,
        requestId,
      },
    });
  }

  // 4. Handle Standard Fastify Input Validation Errors
  if (error.validation) {
    const details = error.validation.map((err) => ({
      field: err.instancePath.replace(/^\//, '') || err.params?.missingProperty || 'field',
      issue: err.message || 'Invalid input value.',
    }));
    const valMsg = details[0]?.issue ? `Validation error: ${details[0].issue}` : 'Validation failed.';

    return reply.status(400).send({
      success: false,
      message: valMsg,
      error: {
        code: 'VALIDATION_ERROR',
        message: valMsg,
        requestId,
        details,
      },
    });
  }

  // 5. Catch-All Unhandled Errors (No stack trace or internal SQL leak in production)
  SecurityLogger.log({
    action: 'UNHANDLED_EXCEPTION',
    severity: 'SECURITY_ALERT',
    ipAddress,
    userId: user?.id,
    route,
    statusCode: 500,
    details: error.message,
  });

  logger.error({
    msg: 'Unhandled internal error',
    err: error.message,
    stack: error.stack,
    requestId,
  });

  const internalMsg = isProd ? 'An internal server error occurred.' : error.message;
  return reply.status(500).send({
    success: false,
    message: internalMsg,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: internalMsg,
      requestId,
    },
  });
};
