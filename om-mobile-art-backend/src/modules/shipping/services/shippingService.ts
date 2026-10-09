import { prisma } from '../../../database/client.js';
import { shippingRepository } from '../repositories/shippingRepository.js';
import { emailService } from '../../../services/email/emailService.js';
import { 
  OrderStatus, 
  FulfillmentStatus, 
  ShipmentStatus, 
  PaymentStatus 
} from '@prisma/client';
import { 
  AppError, 
  NotFoundError, 
  ValidationError 
} from '../../../core/exceptions/exceptions.js';

export class ShippingService {
  /**
   * 1. Generate Shipment for Paid Order (Generic Provider-Neutral Architecture)
   */
  public static async generateShipment(orderIdInput: string) {
    if (!orderIdInput) {
      throw new ValidationError('Order ID is required');
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: orderIdInput },
          { orderNumber: orderIdInput },
        ],
        deletedAt: null,
      },
      include: {
        items: true,
        user: true,
        shipments: true,
      },
    });

    if (!order) {
      throw new NotFoundError(`Order '${orderIdInput}' not found`);
    }

    // Security Check: Cancelled orders can NEVER create shipments
    if (order.status === OrderStatus.CANCELLED) {
      throw new AppError('Cancelled orders cannot create shipments.', 400, 'ORDER_CANCELLED');
    }

    if (order.paymentStatus !== PaymentStatus.PAID && order.status === OrderStatus.PENDING_PAYMENT) {
      throw new AppError('Order must be paid before creating a shipment.', 400, 'ORDER_UNPAID');
    }

    // Idempotency: Prevent duplicate shipment creation
    const existingShipment = await shippingRepository.findByOrderId(order.id);
    if (existingShipment) {
      console.log(`[ShippingService] ℹ️ Order ${order.orderNumber} already has shipment ${existingShipment.trackingNumber}`);
      return {
        success: true,
        message: 'Shipment already exists for this order',
        data: {
          shipmentId: existingShipment.shipmentId,
          trackingNumber: existingShipment.trackingNumber,
          labelUrl: existingShipment.shippingLabelUrl || `/api/v1/shipping/label/${existingShipment.shipmentId}`,
          carrier: existingShipment.carrier,
          status: existingShipment.status,
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      };
    }

    const shipAddr = (order.shippingAddress as any) || {};
    const recipientName = shipAddr.fullName || (shipAddr.firstName ? `${shipAddr.firstName} ${shipAddr.lastName || ''}`.trim() : null) || order.user?.name || 'Customer';

    // Provider-neutral shipment identifiers
    const trackingNumber = order.trackingNumber || `TRK-${order.orderNumber.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
    const shipmentId = `SHP-${order.orderNumber || order.id}-${Date.now().toString().slice(-4)}`;
    const estDeliveryDate = order.estimatedDelivery || new Date(Date.now() + 4 * 86400000);
    const labelUrl = `/api/v1/shipping/label/${shipmentId}`;

    // Save Generic Shipment & Update Order Status to PACKED
    const shipment = await shippingRepository.createShipment({
      orderId: order.id,
      carrier: 'NOT_CONFIGURED',
      trackingNumber,
      shipmentId,
      shippingLabelUrl: labelUrl,
      status: ShipmentStatus.BOOKED,
      estimatedDelivery: estDeliveryDate,
    });

    const trackingLink = `http://localhost:8080/shop/pages/track_order.html?trackingNumber=${trackingNumber}`;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PACKED,
          fulfillmentStatus: FulfillmentStatus.PACKED,
          trackingNumber,
          courierName: 'Standard Shipping',
          courierLink: trackingLink,
          estimatedDelivery: estDeliveryDate,
        },
      });

      await tx.orderTimelineEvent.create({
        data: {
          orderId: order.id,
          eventType: 'SHIPMENT_GENERATED',
          title: 'Order Packed & Shipment Created',
          description: `Shipment created. Tracking Number: ${trackingNumber}`,
          actorType: 'ADMIN',
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PACKED,
          comment: `Order packed & shipping label generated (${trackingNumber})`,
          updatedBy: 'Admin',
        },
      });
    });

    // Send Email Notification (Order Packed)
    const recipientEmail = shipAddr.email || order.user?.email;
    if (recipientEmail) {
      emailService.sendTemplateEmail(
        'ORDER_CONFIRMATION' as any,
        recipientEmail,
        {
          recipient: { email: recipientEmail, name: recipientName },
          orderNumber: order.orderNumber,
          trackOrderUrl: trackingLink,
          items: order.items.map(i => ({ name: i.productName, quantity: i.quantity, price: i.pricePaid })),
          subtotal: order.subtotal,
          total: order.total,
          shippingAddress: shipAddr,
        } as any
      ).catch(() => {});
    }

    return {
      success: true,
      message: 'Shipment created successfully',
      data: {
        shipmentId: shipment.shipmentId,
        trackingNumber: shipment.trackingNumber,
        labelUrl: shipment.shippingLabelUrl,
        carrier: shipment.carrier,
        status: 'PACKED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        estimatedDelivery: estDeliveryDate,
      },
    };
  }

  /**
   * 2. Mark Order SHIPPED / Dispatched
   */
  public static async dispatchShipment(orderIdInput: string) {
    if (!orderIdInput) {
      throw new ValidationError('Order ID is required');
    }

    let shipment = await shippingRepository.findByOrderId(orderIdInput);
    if (!shipment) {
      const genRes = await this.generateShipment(orderIdInput);
      shipment = await shippingRepository.findByShipmentId(genRes.data.shipmentId);
    }

    if (!shipment) {
      throw new NotFoundError('Shipment record not found');
    }

    const order = await prisma.order.findUnique({
      where: { id: shipment.orderId },
      include: { items: true, user: true },
    });

    if (!order) {
      throw new NotFoundError('Associated order not found');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new AppError('Cannot dispatch a cancelled order.', 400, 'ORDER_CANCELLED');
    }

    const dispatchDate = new Date();

    // Update Shipment and Order Status to SHIPPED
    await shippingRepository.updateShipmentStatus(shipment.id, ShipmentStatus.SHIPPED, {
      dispatchDate,
    });

    const courierName = order.courierName || 'Standard Delivery';
    const trackingLink = order.courierLink || `http://localhost:8080/shop/pages/track_order.html?trackingNumber=${shipment.trackingNumber}`;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.SHIPPED,
          fulfillmentStatus: FulfillmentStatus.FULFILLED,
          trackingNumber: shipment!.trackingNumber,
          courierName,
          courierLink: trackingLink,
        },
      });

      await tx.orderTimelineEvent.create({
        data: {
          orderId: order.id,
          eventType: 'ORDER_DISPATCHED',
          title: 'Order Dispatched',
          description: `Dispatched via ${courierName}. Tracking Number: ${shipment!.trackingNumber}`,
          actorType: 'ADMIN',
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.SHIPPED,
          comment: `Handed over to courier (${shipment!.trackingNumber})`,
          updatedBy: 'Admin',
        },
      });
    });

    // Dispatch "Order Shipped" Email to Customer
    const shipAddr = (order.shippingAddress as any) || {};
    const recipientEmail = shipAddr.email || order.user?.email;
    const recipientName = shipAddr.fullName || (shipAddr.firstName ? `${shipAddr.firstName} ${shipAddr.lastName || ''}`.trim() : null) || order.user?.name || 'Customer';

    if (recipientEmail) {
      emailService.sendOrderShipped({
        recipient: { email: recipientEmail, name: recipientName },
        orderNumber: order.orderNumber,
        carrier: courierName,
        trackingNumber: shipment.trackingNumber,
        trackingUrl: trackingLink,
        estimatedDeliveryDate: shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toLocaleDateString() : '3 - 5 Business Days',
        shippingAddress: {
          firstName: shipAddr.firstName || recipientName,
          lastName: shipAddr.lastName || '',
          street: shipAddr.addressLine1 || shipAddr.street || '',
          city: shipAddr.city || '',
          state: shipAddr.state || '',
          zip: shipAddr.pincode || shipAddr.zip || '',
          phone: shipAddr.phone || shipAddr.mobile || '',
        },
      }).catch(err => console.error('[ShippingService] Failed to send Order Shipped email:', err));
    }

    return {
      success: true,
      message: 'Order marked SHIPPED and customer notified',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        trackingNumber: shipment.trackingNumber,
        status: 'SHIPPED',
        dispatchDate,
      },
    };
  }

  /**
   * 3. Update Shipment & Order Status Manually / Automatically (IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED)
   */
  public static async updateStatus(
    orderIdInput: string,
    targetStatusInput: string,
    timelineComment?: string
  ) {
    if (!orderIdInput || !targetStatusInput) {
      throw new ValidationError('orderId and status are required');
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: orderIdInput },
          { orderNumber: orderIdInput },
        ],
      },
      include: { user: true, items: true, shipments: true },
    });

    if (!order) {
      throw new NotFoundError(`Order '${orderIdInput}' not found`);
    }

    const statusUpper = targetStatusInput.toUpperCase();
    let shipmentStatus: ShipmentStatus = ShipmentStatus.IN_TRANSIT;
    let orderStatus: OrderStatus = OrderStatus.SHIPPED;

    if (statusUpper === 'PACKED') {
      shipmentStatus = ShipmentStatus.PACKED;
      orderStatus = OrderStatus.PACKED;
    } else if (statusUpper === 'SHIPPED') {
      shipmentStatus = ShipmentStatus.SHIPPED;
      orderStatus = OrderStatus.SHIPPED;
    } else if (statusUpper === 'IN_TRANSIT') {
      shipmentStatus = ShipmentStatus.IN_TRANSIT;
      orderStatus = OrderStatus.SHIPPED;
    } else if (statusUpper === 'OUT_FOR_DELIVERY') {
      shipmentStatus = ShipmentStatus.OUT_FOR_DELIVERY;
      orderStatus = OrderStatus.OUT_FOR_DELIVERY;
    } else if (statusUpper === 'DELIVERED' || statusUpper === 'COMPLETED') {
      shipmentStatus = ShipmentStatus.DELIVERED;
      orderStatus = OrderStatus.DELIVERED;
    } else if (statusUpper === 'CANCELLED') {
      return this.cancelOrderAndRestoreInventory(order.id, timelineComment || 'Cancelled by Admin');
    }

    const shipment = order.shipments[0];
    if (shipment) {
      await shippingRepository.updateShipmentStatus(shipment.id, shipmentStatus, {
        actualDelivery: shipmentStatus === ShipmentStatus.DELIVERED ? new Date() : undefined,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: orderStatus,
          fulfillmentStatus: orderStatus === OrderStatus.DELIVERED ? FulfillmentStatus.FULFILLED : order.fulfillmentStatus,
        },
      });

      await tx.orderTimelineEvent.create({
        data: {
          orderId: order.id,
          eventType: `STATUS_UPDATED_${statusUpper}`,
          title: `Fulfillment Status: ${statusUpper}`,
          description: timelineComment || `Status updated to ${statusUpper}`,
          actorType: 'ADMIN',
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: orderStatus,
          comment: timelineComment || `Status changed to ${orderStatus}`,
          updatedBy: 'Admin',
        },
      });
    });

    // Send corresponding Email triggers
    const shipAddr = (order.shippingAddress as any) || {};
    const recipientEmail = shipAddr.email || order.user?.email;
    const recipientName = shipAddr.fullName || (shipAddr.firstName ? `${shipAddr.firstName} ${shipAddr.lastName || ''}`.trim() : null) || order.user?.name || 'Customer';

    if (recipientEmail) {
      const shippingAddress = {
        firstName: shipAddr.firstName || recipientName,
        lastName: shipAddr.lastName || '',
        street: shipAddr.addressLine1 || shipAddr.street || '',
        city: shipAddr.city || '',
        state: shipAddr.state || '',
        zip: shipAddr.pincode || shipAddr.zip || '',
        phone: shipAddr.phone || shipAddr.mobile || '',
      };

      if (shipmentStatus === ShipmentStatus.OUT_FOR_DELIVERY) {
        emailService.sendOutForDelivery({
          recipient: { email: recipientEmail, name: recipientName },
          orderNumber: order.orderNumber,
          carrier: order.courierName || 'Standard Delivery',
          shippingAddress,
        }).catch(() => {});
      } else if (shipmentStatus === ShipmentStatus.DELIVERED) {
        emailService.sendDelivered({
          recipient: { email: recipientEmail, name: recipientName },
          orderNumber: order.orderNumber,
          deliveredDate: new Date().toLocaleDateString('en-IN'),
          reviewUrl: `http://localhost:8080/shop/pages/profile.html#orders`,
          shippingAddress,
        }).catch(() => {});
      }
    }

    return {
      success: true,
      message: `Order & Shipment status updated to ${statusUpper}`,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: orderStatus,
        shipmentStatus,
      },
    };
  }

  /**
   * 4. Cancel Order & RESTORE INVENTORY STOCK
   */
  public static async cancelOrderAndRestoreInventory(
    orderIdInput: string,
    reason: string = 'Cancelled by Customer/Admin'
  ) {
    if (!orderIdInput) {
      throw new ValidationError('Order ID is required');
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: orderIdInput },
          { orderNumber: orderIdInput },
        ],
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                inventory: true,
              },
            },
          },
        },
        shipments: true,
        user: true,
      },
    });

    if (!order) {
      throw new NotFoundError(`Order '${orderIdInput}' not found`);
    }

    if (order.status === OrderStatus.CANCELLED) {
      return {
        success: true,
        message: 'Order is already cancelled',
        data: { orderId: order.id, status: 'CANCELLED' },
      };
    }

    // Atomic Transaction: Cancel Order, Cancel Shipment, RESTORE INVENTORY
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
        },
      });

      const shipment = order.shipments[0];
      if (shipment) {
        await tx.shipment.update({
          where: { id: shipment.id },
          data: { status: ShipmentStatus.CANCELLED },
        });
      }

      for (const item of order.items) {
        const variant = item.variant;
        if (variant && variant.inventory) {
          await tx.inventory.update({
            where: { id: variant.inventory.id },
            data: {
              quantity: { increment: item.quantity },
            },
          });

          await tx.inventoryHistory.create({
            data: {
              inventoryId: variant.inventory.id,
              productId: variant.productId,
              productVariantId: variant.id,
              oldQuantity: variant.inventory.quantity,
              newQuantity: variant.inventory.quantity + item.quantity,
              difference: item.quantity,
              reason: `Order Cancelled: Restored ${item.quantity} units for Order #${order.orderNumber} (${reason})`,
              actionType: 'RESTOCK',
              adminName: 'System / Order Cancellation',
            },
          });
        }
      }

      await tx.orderTimelineEvent.create({
        data: {
          orderId: order.id,
          eventType: 'ORDER_CANCELLED',
          title: 'Order Cancelled',
          description: `Order cancelled. Stock restored to inventory. Reason: ${reason}`,
          actorType: 'ADMIN',
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.CANCELLED,
          comment: `Order cancelled: ${reason}. Inventory restored.`,
          updatedBy: 'Admin',
        },
      });
    });

    return {
      success: true,
      message: 'Order cancelled successfully and inventory restored',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'CANCELLED',
        restoredItemsCount: order.items.length,
      },
    };
  }

  /**
   * 5. Get Tracking Details (Generic Provider-Neutral Tracking)
   */
  public static async getTrackingDetails(identifier: string) {
    if (!identifier) {
      throw new ValidationError('Tracking number or Order ID is required');
    }

    let shipment = await shippingRepository.findByTrackingNumber(identifier);
    let order = null;

    if (shipment) {
      order = await prisma.order.findUnique({
        where: { id: shipment.orderId },
        include: {
          items: true,
          user: true,
          shipments: true,
          timelineEvents: { orderBy: { createdAt: 'desc' } },
        },
      });
    } else {
      order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: identifier },
            { orderNumber: { equals: identifier } },
            { trackingNumber: { equals: identifier } },
          ],
        },
        include: {
          items: true,
          user: true,
          shipments: true,
          timelineEvents: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (order && order.shipments.length > 0) {
        shipment = order.shipments[0];
      }
    }

    if (!order) {
      throw new NotFoundError(`No shipment or order found matching '${identifier}'`);
    }

    const trackingNum = shipment?.trackingNumber || order.trackingNumber || `TRK-${order.orderNumber}`;
    const shipAddr = (order.shippingAddress as any) || {};
    const carrierName = order.courierName || shipment?.carrier || 'Standard Courier';

    const events = (order.timelineEvents || []).map((e: any) => ({
      timestamp: e.createdAt,
      status: e.eventType,
      location: 'Fulfillment Center',
      activity: e.description || e.title,
    }));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      carrier: carrierName,
      trackingNumber: trackingNum,
      shipmentId: shipment?.shipmentId || null,
      shippingLabelUrl: shipment?.shippingLabelUrl || `/api/v1/shipping/label/${shipment?.shipmentId || 'mock'}`,
      currentStatus: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentStatus: order.paymentStatus,
      estimatedDelivery: shipment?.estimatedDelivery || order.estimatedDelivery || new Date(Date.now() + 3 * 86400000),
      dispatchDate: shipment?.dispatchDate || null,
      actualDelivery: shipment?.actualDelivery || null,
      recipient: {
        name: shipAddr.fullName || shipAddr.firstName || order.user?.name || 'Customer',
        city: shipAddr.city || 'Destination City',
        state: shipAddr.state || '',
        pincode: shipAddr.pincode || shipAddr.zip || '',
      },
      stepper: [
        { label: 'Order Confirmed', completed: ['PAID', 'PACKED', 'SHIPPED', 'BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.status) },
        { label: 'Packed & Labeled', completed: ['PACKED', 'SHIPPED', 'BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.status) },
        { label: 'Dispatched', completed: ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.status) },
        { label: 'In Transit', completed: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.status) },
        { label: 'Out for Delivery', completed: ['OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.status) },
        { label: 'Delivered', completed: ['DELIVERED', 'COMPLETED'].includes(order.status) },
      ],
      events,
      items: (order.items || []).map((i: any) => ({
        productName: i.productName,
        variantName: i.variantName,
        quantity: i.quantity,
        pricePaid: i.pricePaid,
        imageUrl: i.imageUrl,
      })),
    };
  }

  /**
   * 6. Render Printable Generic Shipping Label HTML
   */
  public static async generateShippingLabel(shipmentId: string): Promise<string> {
    let shipment = await shippingRepository.findByShipmentId(shipmentId);
    if (!shipment) {
      shipment = await shippingRepository.findByOrderId(shipmentId);
    }
    if (!shipment) {
      shipment = await shippingRepository.findByTrackingNumber(shipmentId);
    }

    if (!shipment) {
      throw new NotFoundError(`Shipment '${shipmentId}' not found`);
    }

    const order = await prisma.order.findUnique({
      where: { id: shipment.orderId },
      include: { items: true, user: true },
    });

    if (!order) {
      throw new NotFoundError('Associated order not found');
    }

    const shipAddr = (order.shippingAddress as any) || {};
    const customerName = shipAddr.fullName || (shipAddr.firstName ? `${shipAddr.firstName} ${shipAddr.lastName || ''}`.trim() : null) || order.user?.name || 'Customer';
    const customerPhone = shipAddr.phone || shipAddr.mobile || order.user?.phone || 'N/A';
    const destinationAddress = `${shipAddr.addressLine1 || shipAddr.street || ''}${shipAddr.addressLine2 ? ', ' + shipAddr.addressLine2 : ''}, ${shipAddr.city || ''}, ${shipAddr.state || ''} - ${shipAddr.pincode || shipAddr.zip || ''}`;
    const itemsSummary = order.items.map(i => `${i.productName} (Qty: ${i.quantity})`).join(', ');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Shipping Label - ${order.orderNumber}</title>
        <style>
          @page { size: 100mm 150mm; margin: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 12px; font-size: 11px; color: #111; }
          .label-container { border: 2px solid #000; padding: 10px; width: 92mm; height: 140mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; }
          .brand-title { font-size: 16px; font-weight: 900; letter-spacing: 1px; }
          .barcode-section { text-align: center; padding: 8px 0; border-bottom: 1px dashed #000; }
          .barcode-box { font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 3px; padding: 6px; border: 1px solid #000; display: inline-block; }
          .to-section { padding: 8px 0; border-bottom: 1px solid #000; flex: 1; }
          .to-title { font-weight: bold; font-size: 12px; margin-bottom: 4px; }
          .from-section { font-size: 9px; padding: 6px 0; border-bottom: 1px solid #000; }
          .footer-section { display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; padding-top: 4px; }
        </style>
      </head>
      <body>
        <div class="label-container">
          <div class="header">
            <div class="brand-title">OM MOBILE ART</div>
            <div style="font-size: 9px;">PREMIUM DEVICE SKINS & ACCESSORIES</div>
          </div>
          <div class="barcode-section">
            <div class="barcode-box">${shipment.trackingNumber}</div>
            <div style="font-size: 9px; margin-top: 2px;">Tracking / Shipment Ref: ${shipment.trackingNumber}</div>
          </div>
          <div class="to-section">
            <div class="to-title">DELIVER TO:</div>
            <div style="font-size: 12px; font-weight: bold;">${customerName}</div>
            <div style="margin-top: 3px; line-height: 1.4;">${destinationAddress}</div>
            <div style="margin-top: 4px;"><strong>PIN:</strong> ${shipAddr.pincode || shipAddr.zip || 'N/A'} | <strong>Phone:</strong> ${customerPhone}</div>
            <div style="margin-top: 6px; font-size: 10px; color: #444;">Items: ${itemsSummary}</div>
          </div>
          <div class="from-section">
            <strong>FROM / DISPATCH CENTER:</strong><br>
            OM Mobile Art Studio, 108 Precision Craft Street, Surat, Gujarat - 394101<br>
            Support: support@ommobileart.com
          </div>
          <div class="footer-section">
            <span>ORDER: ${order.orderNumber}</span>
            <span>${order.paymentStatus === 'PAID' ? 'PREPAID' : 'COD: ₹' + order.total.toLocaleString('en-IN')}</span>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
  }

  /**
   * 7. Admin Dashboard Metric Counts
   */
  public static async getAdminDashboardMetrics() {
    const [waitingToPack, readyToShip, todayDispatches, deliveredOrders, cancelledOrders] = await Promise.all([
      prisma.order.count({
        where: {
          status: { in: [OrderStatus.PAID, OrderStatus.CONFIRMED, OrderStatus.PROCESSING] },
          deletedAt: null,
        },
      }),
      prisma.order.count({
        where: {
          status: OrderStatus.PACKED,
          deletedAt: null,
        },
      }),
      prisma.shipment.count({
        where: {
          status: ShipmentStatus.SHIPPED,
          dispatchDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.order.count({
        where: {
          status: OrderStatus.DELIVERED,
          deletedAt: null,
        },
      }),
      prisma.order.count({
        where: {
          status: OrderStatus.CANCELLED,
          deletedAt: null,
        },
      }),
    ]);

    return {
      waitingToPack,
      readyToShip,
      todayDispatches,
      deliveredOrders,
      cancelledOrders,
    };
  }
}

export const shippingService = new ShippingService();
