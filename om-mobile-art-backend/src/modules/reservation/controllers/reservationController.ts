import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { reservationService } from '../services/reservationService.js';
import { 
  ValidationError, 
  AuthenticationError, 
  NotFoundError 
} from '../../../core/exceptions/exceptions.js';
import { 
  createReservationSchema, 
  reservationIdParamSchema 
} from '../validators/reservationValidator.js';

function validateBody<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      issue: err.message,
    }));
    throw new ValidationError('Validation failed', details);
  }
  return result.data;
}

function validateParams<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.errors[0].message);
  }
  return result.data;
}

export class ReservationController {
  async createReservation(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) throw new AuthenticationError('User not authenticated');

    const body = validateBody(createReservationSchema, request.body || {});
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const reservation = await reservationService.createReservation(
      user.id,
      body.durationMinutes || 15,
      ip,
      ua
    );
    return reply.status(201).send({
      success: true,
      data: reservation,
    });
  }

  async getCurrentReservation(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) throw new AuthenticationError('User not authenticated');

    const reservation = await reservationService.getCurrentReservation(user.id);
    return reply.status(200).send({
      success: true,
      data: reservation,
    });
  }

  async cancelCurrentReservation(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) throw new AuthenticationError('User not authenticated');

    const current = await reservationService.getCurrentReservation(user.id);
    if (!current) {
      throw new NotFoundError('No active reservation found');
    }

    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const cancelled = await reservationService.cancelReservation(current.id, user.id, ip, ua);
    return reply.status(200).send({
      success: true,
      data: cancelled,
    });
  }

  async commitReservation(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) throw new AuthenticationError('User not authenticated');

    const params = validateParams(reservationIdParamSchema, request.params);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    // Enforce ownership: user can only commit their own reservation (unless they are admin, but we keep it user-scoped for security)
    const committed = await reservationService.commitReservation(params.id, user.id, ip, ua);
    return reply.status(200).send({
      success: true,
      data: committed,
    });
  }

  async cancelReservation(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) throw new AuthenticationError('User not authenticated');

    const params = validateParams(reservationIdParamSchema, request.params);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const cancelled = await reservationService.cancelReservation(params.id, user.id, ip, ua);
    return reply.status(200).send({
      success: true,
      data: cancelled,
    });
  }
}

export const reservationController = new ReservationController();
