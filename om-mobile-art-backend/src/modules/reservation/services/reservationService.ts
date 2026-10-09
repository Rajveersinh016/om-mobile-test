import { reservationRepository } from '../repositories/reservationRepository.js';
import { cartRepository } from '../../cart/repositories/cartRepository.js';
import { productSelectionService } from '../../catalog/services/productSelectionService.js';
import { prisma } from '../../../database/client.js';
import { 
  NotFoundError, 
  ValidationError, 
  ConflictError,
  AuthenticationError
} from '../../../core/exceptions/exceptions.js';
import { InventoryReservation, ReservationStatus } from '@prisma/client';
import { eventBus } from '../../../core/event/eventBus.js';
import { 
  ReservationCreatedEvent, 
  ReservationCancelledEvent, 
  ReservationCommittedEvent 
} from '../../../core/event/events.js';

export class ReservationService {
  async logActivity(
    userId: string,
    action: string,
    ipAddress?: string,
    userAgent?: string,
    details?: string
  ): Promise<void> {
    await prisma.accountActivity.create({
      data: {
        userId,
        action,
        ipAddress,
        userAgent,
        details,
      },
    });
  }

  async releaseExpiredReservations(): Promise<void> {
    const now = new Date();
    const expired = await reservationRepository.findExpiredActive(now);

    for (const res of expired) {
      try {
        await prisma.$transaction(async (tx) => {
          // Double check status inside transaction
          const current = await tx.inventoryReservation.findUnique({
            where: { id: res.id },
          });

          if (!current || current.status !== 'ACTIVE') return;

          // Mark as EXPIRED
          await tx.inventoryReservation.update({
            where: { id: res.id },
            data: { status: 'EXPIRED' },
          });

          // Restore stockQuantity for each item
          for (const item of res.items) {
            await tx.$executeRaw`
              UPDATE product_variants
              SET \`stockQuantity\` = \`stockQuantity\` + ${item.quantity}
              WHERE id = ${item.productVariantId}
            `;
          }
        });

        await this.logActivity(
          res.userId,
          'RESERVATION_EXPIRE',
          undefined,
          undefined,
          `Released expired reservation ${res.id} (restored variant inventory)`
        );
      } catch (err: any) {
        console.error(`Failed to release expired reservation ${res.id}:`, err);
      }
    }
  }

  async createReservation(
    userId: string,
    durationMinutes = 15,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    // 1. Release expired reservations first
    await this.releaseExpiredReservations();

    // 2. Prevent duplicate active reservations
    const currentActive = await reservationRepository.findCurrentActive(userId);
    if (currentActive) {
      throw new ConflictError('An active inventory reservation already exists for this cart');
    }

    // 3. Load customer cart
    const cart = await cartRepository.findOrCreateCart(userId);
    if (cart.items.length === 0) {
      throw new ValidationError('Cannot reserve inventory for an empty cart');
    }

    // Validate that all items are available
    for (const item of cart.items) {
      const validation = productSelectionService.validatePreloadedSelection(
        item.variant?.product,
        item.variant
      );
      if (validation.status !== 'AVAILABLE') {
        throw new ValidationError(`Cart contains unavailable item: ${item.variant?.sku || 'Unknown'}`);
      }
    }

    try {
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      // 4. Reserve stock inside transaction using Row-Level locking (FOR UPDATE)
      const reservation = await prisma.$transaction(async (tx) => {
        // Lock and verify stock for all variants
        for (const item of cart.items) {
          const variants: any[] = await tx.$queryRaw`
            SELECT id, \`stockQuantity\` 
            FROM product_variants 
            WHERE id = ${item.productVariantId} 
            FOR UPDATE
          `;

          if (!variants || variants.length === 0) {
            throw new ValidationError('Variant no longer exists');
          }

          const stock = variants[0].stockQuantity;
          if (stock < item.quantity) {
            throw new ValidationError(
              `Insufficient inventory for variant SKU ${item.variant?.sku || 'Unknown'}. Available: ${stock}, Requested: ${item.quantity}`
            );
          }

          // Decrement stock
          await tx.$executeRaw`
            UPDATE product_variants
            SET \`stockQuantity\` = \`stockQuantity\` - ${item.quantity}
            WHERE id = ${item.productVariantId}
          `;
        }

        // Create Reservation record
        const res = await tx.inventoryReservation.create({
          data: {
            userId,
            expiresAt,
            status: 'ACTIVE',
            items: {
              create: cart.items.map((item) => ({
                productVariantId: item.productVariantId,
                quantity: item.quantity,
              })),
            },
          },
          include: {
            items: {
              include: {
                variant: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        });

        return res;
      });

      await this.logActivity(
        userId,
        'RESERVATION_CREATE',
        ipAddress,
        userAgent,
        `Created inventory reservation ${reservation.id} expiring at ${expiresAt.toISOString()}`
      );

      await eventBus.publish(
        new ReservationCreatedEvent({
          reservationId: reservation.id,
          userId: reservation.userId,
          items: reservation.items.map((item: any) => ({
            productVariantId: item.productVariantId,
            quantity: item.quantity,
          })),
        })
      );

      return reservation;
    } catch (err: any) {
      await this.logActivity(
        userId,
        'RESERVATION_FAIL',
        ipAddress,
        userAgent,
        `Failed to create reservation: ${err.message}`
      );
      throw err;
    }
  }

  async cancelReservation(
    id: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    await this.releaseExpiredReservations();

    const reservation = await reservationRepository.findById(id, userId);
    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }

    if (reservation.status !== 'ACTIVE') {
      throw new ValidationError('Only active reservations can be cancelled');
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        // Mark status as CANCELLED
        const res = await tx.inventoryReservation.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });

        // Restore stockQuantity
        for (const item of reservation.items) {
          await tx.$executeRaw`
            UPDATE product_variants
            SET \`stockQuantity\` = \`stockQuantity\` + ${item.quantity}
            WHERE id = ${item.productVariantId}
          `;
        }

        return res;
      });

      await this.logActivity(
        reservation.userId,
        'RESERVATION_CANCEL',
        ipAddress,
        userAgent,
        `Cancelled reservation ${id} (restored inventory)`
      );

      await eventBus.publish(
        new ReservationCancelledEvent({
          reservationId: id,
          userId: reservation.userId,
        })
      );

      return updated;
    } catch (err: any) {
      await this.logActivity(
        reservation.userId,
        'RESERVATION_FAIL',
        ipAddress,
        userAgent,
        `Failed to cancel reservation ${id}: ${err.message}`
      );
      throw err;
    }
  }

  async commitReservation(
    id: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    await this.releaseExpiredReservations();

    const reservation = await reservationRepository.findById(id, userId);
    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }

    if (reservation.status === 'COMPLETED') {
      return reservation;
    }

    if (reservation.status === 'EXPIRED' || reservation.status === 'CANCELLED') {
      throw new ValidationError('Cannot commit an expired or cancelled reservation');
    }

    try {
      const updated = await prisma.inventoryReservation.update({
        where: { id },
        data: { status: 'COMPLETED' },
      });

      await this.logActivity(
        reservation.userId,
        'RESERVATION_COMMIT',
        ipAddress,
        userAgent,
        `Committed reservation ${id} (purchase finalized)`
      );

      await eventBus.publish(
        new ReservationCommittedEvent({
          reservationId: id,
          userId: reservation.userId,
        })
      );

      return updated;
    } catch (err: any) {
      await this.logActivity(
        reservation.userId,
        'RESERVATION_FAIL',
        ipAddress,
        userAgent,
        `Failed to commit reservation ${id}: ${err.message}`
      );
      throw err;
    }
  }

  async getCurrentReservation(userId: string): Promise<any> {
    await this.releaseExpiredReservations();
    return reservationRepository.findCurrentActive(userId);
  }
}

export const reservationService = new ReservationService();
