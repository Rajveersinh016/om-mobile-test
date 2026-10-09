import { prisma } from '../../../database/client.js';
import { Shipment, ShipmentStatus } from '@prisma/client';

export class ShippingRepository {
  async createShipment(data: {
    orderId: string;
    carrier?: string;
    trackingNumber: string;
    shipmentId: string;
    shippingLabelUrl?: string;
    status?: ShipmentStatus;
    estimatedDelivery?: Date;
  }): Promise<Shipment> {
    return prisma.shipment.create({
      data: {
        orderId: data.orderId,
        carrier: data.carrier || 'NOT_CONFIGURED',
        trackingNumber: data.trackingNumber,
        shipmentId: data.shipmentId,
        shippingLabelUrl: data.shippingLabelUrl,
        status: data.status || ShipmentStatus.BOOKED,
        estimatedDelivery: data.estimatedDelivery,
      },
    });
  }

  async findByOrderId(orderId: string): Promise<Shipment | null> {
    return prisma.shipment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          include: {
            items: true,
            user: true,
          },
        },
      },
    });
  }

  async findByTrackingNumber(trackingNumber: string): Promise<Shipment | null> {
    return prisma.shipment.findFirst({
      where: {
        OR: [
          { trackingNumber: { equals: trackingNumber } },
          { shipmentId: { equals: trackingNumber } },
        ],
      },
      include: {
        order: {
          include: {
            items: true,
            user: true,
          },
        },
      },
    });
  }

  async findByShipmentId(shipmentId: string): Promise<Shipment | null> {
    return prisma.shipment.findUnique({
      where: { shipmentId },
      include: {
        order: {
          include: {
            items: true,
            user: true,
          },
        },
      },
    });
  }

  async updateShipmentStatus(
    shipmentId: string,
    status: ShipmentStatus,
    extraData?: {
      dispatchDate?: Date;
      actualDelivery?: Date;
      estimatedDelivery?: Date;
    }
  ): Promise<Shipment> {
    return prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status,
        dispatchDate: extraData?.dispatchDate,
        actualDelivery: extraData?.actualDelivery,
        estimatedDelivery: extraData?.estimatedDelivery,
      },
    });
  }
}

export const shippingRepository = new ShippingRepository();
