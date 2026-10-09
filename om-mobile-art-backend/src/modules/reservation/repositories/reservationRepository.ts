import { prisma } from '../../../database/client.js';
import { InventoryReservation, ReservationStatus } from '@prisma/client';

export class ReservationRepository {
  async findById(id: string, userId?: string): Promise<any | null> {
    const whereClause: any = { id };
    if (userId) {
      whereClause.userId = userId;
    }
    return prisma.inventoryReservation.findFirst({
      where: whereClause,
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
  }

  async findCurrentActive(userId: string): Promise<any | null> {
    return prisma.inventoryReservation.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
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
  }

  async findExpiredActive(now: Date): Promise<any[]> {
    return prisma.inventoryReservation.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
      include: {
        items: true,
      },
    });
  }

  async updateStatus(id: string, status: ReservationStatus): Promise<InventoryReservation> {
    return prisma.inventoryReservation.update({
      where: { id },
      data: { status },
    });
  }
}

export const reservationRepository = new ReservationRepository();
