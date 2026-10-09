import { z } from 'zod';

export const createReservationSchema = z.object({
  durationMinutes: z.number().int().min(1).max(60).optional(),
});

export const reservationIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid reservation ID format' }),
});
