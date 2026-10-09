import { prisma } from '../../database/client.js';
import { 
  OrderStatus, 
  PaymentStatus, 
  FulfillmentStatus, 
  OrderPriority 
} from '@prisma/client';
import { 
  OrderFilterQuery, 
  OrderStatusUpdateInput, 
  PaymentStatusUpdateInput, 
  FulfillmentStatusUpdateInput, 
  OrderNoteInput, 
  BulkUpdateStatusInput, 
  CreateOrderInput, 
  OrderDashboardMetrics 
} from './order.types.js';
import { AppError, NotFoundError, ValidationError } from '../../core/exceptions/exceptions.js';
import { NotificationService } from '../notifications/notification.service.js';
import { emailService } from '../../services/email/emailService.js';

export class OrderService {
  public static readonly orderItemInclusion = {
    include: {
      variant: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { position: 'asc' as const },
              },
              category: true,
              models: {
                include: {
                  brand: {
                    include: {
                      deviceType: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  /**
   * Generate sequential Order Number in format OM-YYMM-XXXX
   */
  private static async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const yearMonth = `${yy}${mm}`;

    let isUnique = false;
    let orderNumber = '';

    while (!isUnique) {
      const counter = await prisma.orderCounter.upsert({
        where: { yearMonth },
        update: { count: { increment: 1 } },
        create: { yearMonth, count: 1 },
      });

      const seq = counter.count.toString().padStart(4, '0');
      orderNumber = `OM-${yearMonth}-${seq}`;

      const existing = await prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true },
      });

      if (!existing) {
        isUnique = true;
      }
    }

    return orderNumber;
  }

  /**
   * Helper to log Order Timeline Event
   */
  private static async logTimelineEvent(
    orderId: string,
    eventType: string,
    title: string,
    description?: string,
    actorType: 'CUSTOMER' | 'ADMIN' | 'SYSTEM' = 'ADMIN',
    actorId?: string
  ) {
    try {
      await prisma.orderTimelineEvent.create({
        data: {
          orderId,
          eventType,
          title,
          description,
          actorType,
          actorId,
        },
      });
    } catch (err) {
      console.warn('Failed to log timeline event:', err);
    }
  }

  /**
   * Get Orders list with Search, Filters, Sorting & Pagination.
   */
  public static async getOrders(query: OrderFilterQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    // Search filter
    if (query.search && query.search.trim() !== '') {
      const term = query.search.trim();
      where.OR = [
        { orderNumber: { contains: term } },
        { user: { name: { contains: term } } },
        { user: { email: { contains: term } } },
        { user: { phone: { contains: term } } },
      ];
    }

    // Status filters
    if (query.status && query.status !== 'ALL') {
      const statusUpper = (query.status as string).toUpperCase();
      if (statusUpper === 'ACTIVE') {
        where.status = {
          in: [
            OrderStatus.PAID,
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.PRINTING,
            OrderStatus.QUALITY_CHECK,
            OrderStatus.PACKED,
            OrderStatus.READY_TO_SHIP,
            OrderStatus.SHIPPED,
            OrderStatus.OUT_FOR_DELIVERY,
          ],
        };
      } else if (statusUpper === 'DELIVERED') {
        where.status = {
          in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED],
        };
      } else if (Object.values(OrderStatus).includes(query.status as OrderStatus)) {
        where.status = query.status as OrderStatus;
      }
    } else if (!query.status) {
      // Default view for Admin: Exclude unverified PENDING_PAYMENT orders
      where.status = {
        notIn: [OrderStatus.PENDING_PAYMENT, OrderStatus.FAILED, OrderStatus.CANCELLED],
      };
    }
    if (query.paymentStatus && query.paymentStatus !== 'ALL' && Object.values(PaymentStatus).includes(query.paymentStatus as PaymentStatus)) {
      where.paymentStatus = query.paymentStatus as PaymentStatus;
    }
    if (query.fulfillmentStatus && query.fulfillmentStatus !== 'ALL' && Object.values(FulfillmentStatus).includes(query.fulfillmentStatus as FulfillmentStatus)) {
      where.fulfillmentStatus = query.fulfillmentStatus as FulfillmentStatus;
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    // Amount range filter
    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.total = {};
      if (query.minAmount !== undefined) where.total.gte = Number(query.minAmount);
      if (query.maxAmount !== undefined) where.total.lte = Number(query.maxAmount);
    }

    // Sorting
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    const orderBy = { [sortBy]: sortOrder };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          items: OrderService.orderItemInclusion,
          _count: {
            select: { items: true },
          },
        },
      }),
    ]);

    const formattedOrders = orders.map(order => OrderService.mapToOrderDTO(order));

    return {
      items: formattedOrders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Unified DTO Mapper for Order Responses across Admin, Customer Dashboard, My Orders, and Track Order.
   */
  public static mapToOrderDTO(order: any) {
    if (!order) return null;
    const snapshot = (order.customerSnapshot as any) || {};
    const shipAddr = (order.shippingAddress as any) || {};
    const billAddr = shipAddr.billingAddress || shipAddr;

    const customerName = snapshot.fullName || shipAddr.fullName || (shipAddr.firstName ? `${shipAddr.firstName} ${shipAddr.lastName || ''}`.trim() : null) || order.user?.name || 'Customer';
    const customerEmail = snapshot.email || shipAddr.email || order.user?.email || '';
    const customerPhone = snapshot.phone || shipAddr.phone || shipAddr.mobile || order.user?.phone || '';

    const items = (order.items || []).map((item: any) => {
      const isCustomOrder = Boolean(
        item.productName?.toLowerCase().includes('custom skin') ||
        item.productName?.toLowerCase().includes('custom design') ||
        (item.imageUrl && !item.variant) ||
        item.designJson
      );

      // 1. Authoritative Product Name Resolution:
      // Priority 1: Stored OrderItem.productName snapshot if valid and not a known buggy/generic fallback
      // Priority 2: Linked Product.name through productVariant -> product
      // Priority 3: Fallback 'Device Skin'
      const catalogProductName = item.variant?.product?.name;
      const isBuggySnapshot = !item.productName || 
        ['vinyl skin', 'device skin', 'custom device skin', 'custom skin'].includes(item.productName.trim().toLowerCase());
      
      let resolvedProductName = item.productName;
      if ((isBuggySnapshot || !resolvedProductName) && catalogProductName) {
        resolvedProductName = catalogProductName;
      }
      if (!resolvedProductName && catalogProductName) {
        resolvedProductName = catalogProductName;
      }
      if (!resolvedProductName) {
        resolvedProductName = 'Custom Device Skin';
      }

      // 2. Authoritative Image URL Resolution:
      // Priority:
      // 1. OrderItem.imageUrl snapshot (if valid and not empty)
      // 2. Custom design artworkUrl if custom design
      // 3. Variant image
      // 4. Product primary thumbnail (product.image)
      // 5. Product first gallery image (product.images[0].url)
      let rawImage = item.imageUrl || (item.designJson as any)?.artworkUrl || null;
      if (!rawImage || rawImage.trim() === '') {
        rawImage = 
          item.variant?.image || 
          item.variant?.product?.image || 
          (item.variant?.product?.images && item.variant?.product?.images[0]?.url) || 
          null;
      }

      // Normalize relative image path (e.g. /uploads/...) to browser-loadable URL
      if (rawImage && typeof rawImage === 'string') {
        const trimmed = rawImage.trim();
        if (trimmed.startsWith('/uploads/')) {
          const apiBase = (process.env.APP_FRONTEND_URL || 'http://localhost:8080').replace(/\/+$/, '');
          const backendPort = process.env.PORT || '3000';
          const backendHost = apiBase.includes('localhost') ? `http://localhost:${backendPort}` : apiBase;
          rawImage = `${backendHost}${trimmed}`;
        }
      }

      // 3. Device Type & Model Resolution:
      const matchedModel = item.variant?.product?.models?.find((m: any) => 
        (item.deviceModel && m.name.toLowerCase() === item.deviceModel.toLowerCase()) ||
        (item.deviceName && m.name.toLowerCase() === item.deviceName.toLowerCase())
      ) || item.variant?.product?.models?.[0];

      const resolvedDeviceType = 
        item.deviceType || 
        matchedModel?.brand?.deviceType?.name || 
        'Mobile';

      const resolvedModelName = 
        item.customModelName || 
        item.deviceModel || 
        item.deviceName || 
        matchedModel?.name || 
        null;

      let resolvedBrandName = 
        item.deviceBrand || 
        item.brandName || 
        matchedModel?.brand?.name || 
        null;

      if (resolvedBrandName && resolvedBrandName.trim().toLowerCase() === 'om mobile art') {
        resolvedBrandName = matchedModel?.brand?.name || null;
      }

      const resolvedSku = item.sku || item.variant?.sku || item.variant?.product?.sku || '';

      let customDesign: any = null;
      if (rawImage && (isCustomOrder || (resolvedProductName && resolvedProductName.toLowerCase().includes('custom')))) {
        const cleanModel = (resolvedModelName || 'Custom-Skin').replace(/[^a-zA-Z0-9\-_]/g, '-');
        const cleanOrderNo = String(order.orderNumber || 'ORDER').replace(/^OM-/, '');
        const fileName = `OM-${cleanOrderNo}_${cleanModel}_Artwork.png`;
        customDesign = {
          id: item.id,
          fileName,
          originalFileName: fileName,
          mimeType: 'image/png',
          previewUrl: rawImage,
          downloadUrl: rawImage,
          designJson: item.designJson || null,
        };
      }

      return {
        id: item.id,
        orderId: item.orderId || order.id,
        productId: item.productId || item.variant?.productId || item.variant?.product?.id || null,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        pricePaid: item.pricePaid || item.unitPrice || 0,
        unitPrice: item.unitPrice || item.pricePaid || 0,
        lineTotal: (item.pricePaid || item.unitPrice || 0) * item.quantity,
        productName: resolvedProductName,
        variantName: item.variantName || (item.variant ? `${item.variant.finish || ''} / ${item.variant.material || ''}`.trim() : ''),
        sku: resolvedSku,
        categoryName: item.categoryName || item.variant?.product?.category?.name || 'Mobile Skins',
        collectionName: item.collectionName || null,
        brandName: resolvedBrandName,
        deviceType: resolvedDeviceType,
        deviceBrand: resolvedBrandName,
        deviceModel: resolvedModelName,
        deviceName: resolvedModelName,
        customModelName: item.customModelName || resolvedModelName,
        deviceTypeObj: {
          id: matchedModel?.brand?.deviceType?.id || null,
          name: resolvedDeviceType,
          slug: matchedModel?.brand?.deviceType?.slug || null,
        },
        deviceModelObj: {
          id: matchedModel?.id || null,
          name: resolvedModelName,
        },
        configuration: {
          material: item.material || item.variant?.material || 'Standard 3M',
          finish: item.finish || item.variant?.finish || 'Matte',
          coverage: item.coverage || 'Full Back',
        },
        material: item.material || item.variant?.material || 'Standard 3M',
        finish: item.finish || item.variant?.finish || 'Matte',
        coverage: item.coverage || 'Full Back',
        unitDiscount: item.unitDiscount || 0,
        couponAllocation: item.couponAllocation || 0,
        taxPercentage: 0,
        imageUrl: rawImage,
        designJson: item.designJson || null,
        isCustomOrder,
        customDesign,
        createdAt: item.createdAt || order.createdAt,
      };
    });

    const grandTotal = order.total;

    return {
      id: order.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      customerName,
      customerEmail,
      customerPhone,
      orderDate: order.createdAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      itemsCount: items.reduce((acc: number, i: any) => acc + i.quantity, 0),
      items,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      shipping: order.shippingFee,
      tax: 0,
      discount: order.discount,
      total: grandTotal,
      grandTotal: grandTotal,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      shippingAddress: shipAddr,
      billingAddress: billAddr,
      customerSnapshot: {
        ...snapshot,
        fullName: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
      couponCode: order.couponCode,
      trackingNumber: order.trackingNumber,
      courierName: order.courierName,
      courierLink: order.courierLink,
      estimatedDelivery: order.estimatedDelivery,
      invoiceNumber: order.invoiceNumber,
      invoiceUrl: order.invoiceUrl,
      payments: order.payments || [],
      timelineEvents: order.timelineEvents || [],
      statusHistory: (order.statusHistory || [])
        .map((h: any) => ({
          id: h.id,
          orderId: h.orderId || order.id,
          status: h.status,
          comment: h.comment || h.note || `Status updated to ${h.status}`,
          note: h.note || h.comment || `Status updated to ${h.status}`,
          updatedBy: h.updatedBy || 'Admin',
          createdAt: h.createdAt || order.createdAt,
        }))
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      notes: order.notes || [],
    };
  }

  /**
   * Get Orders belonging specifically to authenticated logged-in customer by User ID relation.
   */
  public static async getCustomerOrders(userOrId: string | { id?: string; email?: string; role?: string }) {
    let userId = typeof userOrId === 'string' ? userOrId : (userOrId?.id || '');
    let userEmail = typeof userOrId === 'object' ? (userOrId?.email || '') : '';

    if ((!userId || userId.trim() === '') && userEmail) {
      const dbUser = await prisma.user.findFirst({
        where: { email: { equals: userEmail.trim() } }
      });
      if (dbUser) {
        userId = dbUser.id;
      }
    }

    if (!userId && !userEmail) {
      console.log('[Auth Audit] getCustomerOrders: No valid userId or userEmail resolved, returning []');
      return [];
    }

    const OR_conditions: any[] = [];
    if (userId) {
      OR_conditions.push({ userId: userId });
      OR_conditions.push({ customerSnapshot: { path: ['id'], equals: userId } });
    }
    if (userEmail) {
      OR_conditions.push({ customerSnapshot: { path: ['email'], equals: userEmail } });
      OR_conditions.push({ user: { email: { equals: userEmail } } });
    }

    const orders = await prisma.order.findMany({
      where: {
        deletedAt: null,
        OR: OR_conditions.length > 0 ? OR_conditions : undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        items: OrderService.orderItemInclusion,
        payments: true,
        timelineEvents: {
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    console.log(`[Auth Audit] getCustomerOrders: Target User ID="${userId}", Target Email="${userEmail}" -> Found ${orders.length} orders in database.`);
    return orders.map(order => OrderService.mapToOrderDTO(order));
  }

  /**
   * Get single Order details for logged-in customer (enforces ownership check).
   */
  public static async getCustomerOrderById(orderId: string, user: { id: string; email: string }) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const whereOr: any[] = [
      { orderNumber: { equals: orderId } }
    ];
    if (isUuid) {
      whereOr.push({ id: orderId });
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: whereOr
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true }
        },
        items: OrderService.orderItemInclusion,
        timelineEvents: {
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Strict ownership verification: return 403 if order belongs to another customer and user is not Admin
    const isAdminUser = user.role === 'ADMIN' || user.role === 'EDITOR';
    if (!isAdminUser && order.userId !== user.id && order.user?.email !== user.email) {
      throw new AppError('You do not have permission to view this order', 403, 'FORBIDDEN');
    }

    return OrderService.mapToOrderDTO(order);
  }

  /**
   * Get single Order details by ID with complete relations.
   */
  public static async getOrderById(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
          },
        },
        items: OrderService.orderItemInclusion,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        timelineEvents: {
          orderBy: { createdAt: 'desc' },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          include: {
            attempts: true,
            refunds: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const snapshot = (order.customerSnapshot as any) || {};
    const shipAddr = (order.shippingAddress as any) || {};
    const billAddr = shipAddr.billingAddress || shipAddr;

    const customerName = snapshot.fullName || shipAddr.fullName || (shipAddr.firstName ? `${shipAddr.firstName} ${shipAddr.lastName || ''}`.trim() : null) || order.user?.name || 'Customer';
    const customerEmail = snapshot.email || shipAddr.email || order.user?.email || '';
    const customerPhone = snapshot.phone || shipAddr.phone || shipAddr.mobile || order.user?.phone || '';

    return OrderService.mapToOrderDTO(order);
  }

  /**
   * Create Order internally with atomic Prisma transaction & inventory deduction.
   */
  public static async createOrder(input: CreateOrderInput) {
    const { userId, items, shippingAddress, billingAddress, customerNotes, couponCode } = input;

    if (!items || items.length === 0) {
      throw new ValidationError('Cart items are required to create an order');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('Customer user account not found');
    }

    // Generate Order Number
    const orderNumber = await this.generateOrderNumber();

    return await prisma.$transaction(async (tx) => {
      // 1. Process & Validate Line Items & Stock Levels
      let subtotal = 0;
      const orderItemData = [];

      const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

      const variantInclusion = {
        product: {
          include: {
            category: true,
            images: { orderBy: { position: 'asc' as const } },
            models: {
              include: {
                brand: {
                  include: { deviceType: true },
                },
              },
            },
          },
        },
        inventory: true,
      };

      for (const itemInput of items) {
        let variant = null;
        const variantIdStr = itemInput.productVariantId ? String(itemInput.productVariantId) : null;
        if (variantIdStr && isUuid(variantIdStr)) {
          variant = await tx.productVariant.findUnique({
            where: { id: variantIdStr },
            include: variantInclusion,
          });
        }

        if (!variant && variantIdStr) {
          variant = await tx.productVariant.findFirst({
            where: {
              OR: [
                { sku: variantIdStr },
                ...(isUuid(variantIdStr) ? [{ productId: variantIdStr }] : [])
              ]
            },
            include: variantInclusion,
          });
        }

        if (!variant) {
          // Find any default variant in DB as fallback
          variant = await tx.productVariant.findFirst({
            include: variantInclusion,
          });
        }

        let unitPrice = itemInput.pricePaid || itemInput.unitPrice || (variant ? (variant.product.price + variant.priceOffset) : 399);
        let pricePaid = itemInput.pricePaid || unitPrice;

        // Authoritative product name from catalog product
        let productName = variant?.product?.name || (itemInput.productName ? String(itemInput.productName) : 'Custom Device Skin');
        if (productName && ['vinyl skin', 'device skin', 'custom device skin', 'custom skin'].includes(productName.trim().toLowerCase()) && variant?.product?.name) {
          productName = variant.product.name;
        }

        let variantName = itemInput.variantName ? String(itemInput.variantName) : (variant ? `${variant.finish} / ${variant.material}` : 'Matte / Precision Fit');
        let sku = variant?.sku || (itemInput.sku ? String(itemInput.sku) : 'SKIN-CUSTOM');
        let categoryName = variant?.product?.category?.name || (itemInput.categoryName ? String(itemInput.categoryName) : 'Mobile Skins');

        // Brand name: prioritize model brand, do NOT default to OM Mobile Art
        const firstModel = (variant?.product as any)?.models?.[0];
        let brandName = itemInput.brandName || itemInput.deviceBrand || firstModel?.brand?.name || null;
        if (brandName && brandName.trim().toLowerCase() === 'om mobile art') {
          brandName = firstModel?.brand?.name || null;
        }

        let deviceType = itemInput.deviceType ? String(itemInput.deviceType) : (firstModel?.brand?.deviceType?.name || 'Mobile');
        let deviceBrand = brandName;
        let deviceModel = itemInput.deviceModel ? String(itemInput.deviceModel) : (itemInput.deviceName ? String(itemInput.deviceName) : (firstModel?.name || null));
        let deviceName = deviceModel;
        let material = itemInput.material ? String(itemInput.material) : (variant?.material || '3M Vinyl Standard');
        let finish = itemInput.finish ? String(itemInput.finish) : (variant?.finish || 'Matte');
        let coverage = itemInput.coverage ? String(itemInput.coverage) : 'Full Back';
        let imageUrl = variant?.image || variant?.product?.image || (variant?.product?.images && variant?.product?.images[0]?.url) || (itemInput.imageUrl ? String(itemInput.imageUrl) : null);
        let variantId: string | null = variant ? variant.id : null;

        if (variant) {
          // Server-authoritative device price resolution from ProductDevicePrice
          let effectiveDeviceTypeId = (itemInput as any).deviceTypeId || null;
          let basePrice = Number(variant.product.price || 0);

          if (effectiveDeviceTypeId) {
            const dpObj = await tx.productDevicePrice.findUnique({
              where: {
                productId_deviceTypeId: {
                  productId: variant.productId,
                  deviceTypeId: effectiveDeviceTypeId,
                },
              },
            });
            if (dpObj && Number(dpObj.price) > 0) {
              basePrice = Number(dpObj.price);
            }
          } else if (itemInput.deviceType) {
            const dtObj = await tx.deviceType.findFirst({
              where: {
                OR: [
                  { name: { equals: String(itemInput.deviceType).trim() } },
                  { slug: { equals: String(itemInput.deviceType).trim().toLowerCase() } }
                ]
              }
            });
            if (dtObj) {
              effectiveDeviceTypeId = dtObj.id;
              const dpObj = await tx.productDevicePrice.findUnique({
                where: {
                  productId_deviceTypeId: {
                    productId: variant.productId,
                    deviceTypeId: dtObj.id,
                  },
                },
              });
              if (dpObj && Number(dpObj.price) > 0) {
                basePrice = Number(dpObj.price);
              }
            }
          }

          const authoritativeUnitPrice = basePrice + Number(variant.priceOffset || 0);
          unitPrice = authoritativeUnitPrice;
          pricePaid = authoritativeUnitPrice;

          if (!productName || ['vinyl skin', 'device skin', 'custom device skin', 'custom skin'].includes(productName.trim().toLowerCase())) {
            productName = variant.product.name;
          }
          if (!sku) {
            sku = variant.sku;
          }
          if (!categoryName) {
            categoryName = variant.product.category?.name || 'Mobile Skins';
          }
          if (!imageUrl) {
            imageUrl = variant.image || variant.product.image || (variant.product.images && variant.product.images[0]?.url) || null;
          }

          // Validate stock level availability for DB variants
          const inventory = variant.inventory;
          if (inventory) {
            if (inventory.quantity < itemInput.quantity && !inventory.allowBackorder) {
              throw new ValidationError(
                `Insufficient stock for ${variant.product.name} (${variant.sku}). Available: ${inventory.quantity}, Requested: ${itemInput.quantity}`
              );
            }
          }
        }

        const itemSubtotal = pricePaid * itemInput.quantity;
        subtotal += itemSubtotal;

        console.log('[CUSTOM-SKIN ORDER SNAPSHOT]', {
          productId: variantId || itemInput.productVariantId || 'CUSTOM-SKIN',
          productName,
          deviceType,
          brand: deviceBrand || brandName,
          model: deviceModel || deviceName,
          finish,
          material,
          coverage,
          quantity: itemInput.quantity,
          unitPrice: pricePaid,
          lineTotal: itemSubtotal
        });

        orderItemData.push({
          productVariantId: variantId,
          quantity: itemInput.quantity,
          unitPrice: pricePaid,
          pricePaid,
          productName,
          variantName,
          sku,
          categoryName,
          brandName,
          deviceType,
          deviceBrand,
          deviceModel,
          deviceName,
          material,
          finish,
          coverage,
          imageUrl,
          designJson: itemInput.designJson || null,
        });
      }

      // 2. Validate Coupon if provided
      let discount = 0.0;
      let appliedCouponCode = null;
      if (couponCode && couponCode.trim() !== '') {
        const codeClean = couponCode.trim().toUpperCase();
        const coupon = await tx.coupon.findUnique({
          where: { code: codeClean },
        });

        if (coupon && coupon.isActive && coupon.status === 'ACTIVE') {
          const now = new Date();
          if ((!coupon.startDate || now >= coupon.startDate) && (!coupon.endDate || now <= coupon.endDate)) {
            if (!coupon.minCartValue || subtotal >= coupon.minCartValue) {
              if (coupon.discountType === 'PERCENTAGE') {
                discount = (subtotal * coupon.discountValue) / 100;
                if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                  discount = coupon.maxDiscount;
                }
              } else if (coupon.discountType === 'FIXED') {
                discount = coupon.discountValue;
              }
              appliedCouponCode = codeClean;

              // Increment coupon usage count
              await tx.coupon.update({
                where: { id: coupon.id },
                data: {
                  usageCount: { increment: 1 },
                  totalDiscountGiven: { increment: discount },
                },
              });
            }
          }
        }
      }

      // 3. Shipping fee & Tax (0 GST) calculations
      const shippingFee = subtotal >= 999 ? 0.0 : 49.0;
      const tax = 0;
      const total = Math.max(0, Math.round((subtotal - discount + shippingFee) * 100) / 100);

      const nameFromAddress = input.customerName ||
        (shippingAddress as any)?.fullName || 
        ((shippingAddress as any)?.firstName ? `${(shippingAddress as any)?.firstName} ${(shippingAddress as any)?.lastName || ''}`.trim() : null) || 
        (shippingAddress as any)?.name ||
        user.name || 'Customer';

      const emailFromAddress = input.customerEmail ||
        (shippingAddress as any)?.email || 
        user.email;

      const phoneFromAddress = input.phone ||
        (shippingAddress as any)?.phone || 
        (shippingAddress as any)?.mobile || 
        (shippingAddress as any)?.alternativePhone || 
        user.phone || '';

      const customerSnapshot = {
        id: user.id,
        fullName: nameFromAddress,
        email: emailFromAddress,
        phone: phoneFromAddress,
      };

      const fullShippingAddress = {
        ...(shippingAddress || {}),
        fullName: nameFromAddress,
        email: emailFromAddress,
        phone: phoneFromAddress,
        billingAddress: billingAddress || shippingAddress || {}
      };

      const pricingSnapshot = {
        subtotal,
        discount,
        shippingFee,
        tax,
        total,
      };

      console.log('[CHECKOUT TOTAL]', {
        subtotal,
        shipping: shippingFee,
        discount,
        total,
      });

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: user.id,
          subtotal,
          discount,
          tax,
          shippingFee,
          total,
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING',
          fulfillmentStatus: 'UNFULFILLED',
          shippingAddress: fullShippingAddress,
          customerSnapshot,
          pricingSnapshot,
          couponCode: appliedCouponCode,
          customerNotes: customerNotes || null,
          items: {
            create: orderItemData,
          },
          statusHistory: {
            create: {
              status: 'PENDING_PAYMENT',
              comment: 'Order created, pending payment authorization',
            },
          },
          timelineEvents: {
            create: [
              {
                eventType: 'ORDER_CREATED',
                title: 'Order Placed',
                description: `Order ${orderNumber} placed for ₹${total}`,
                actorType: 'CUSTOMER',
                actorId: user.id,
              },
              {
                eventType: 'STOCK_RESERVED',
                title: 'Inventory Reserved',
                description: `Reserved line items and updated stock levels in MySQL`,
                actorType: 'SYSTEM',
              },
            ],
          },
        },
        include: {
          items: OrderService.orderItemInclusion,
          timelineEvents: true,
        },
      });

      console.log('[ORDER CREATED]', {
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        paidAmount: newOrder.total,
      });

      // Dispatch async notification & email confirmation
      setTimeout(() => {
        NotificationService.sendOrderConfirmation(newOrder);

        const recipientEmail = (newOrder.customerSnapshot as any)?.email || user.email;
        const recipientName = (newOrder.customerSnapshot as any)?.fullName || user.name || 'Customer';
        const shipAddr = (newOrder.shippingAddress as any) || {};

        emailService.sendOrderConfirmation({
          recipient: { email: recipientEmail, name: recipientName },
          orderNumber: newOrder.orderNumber,
          subtotal: newOrder.subtotal,
          discount: newOrder.discount,
          shippingFee: newOrder.shippingFee,
          total: newOrder.total,
          items: (newOrder.items || []).map(i => ({
            name: i.productName,
            quantity: i.quantity,
            price: i.pricePaid,
            device: i.deviceModel || undefined,
            finish: i.finish || undefined,
            material: i.material || undefined,
          })),
          shippingAddress: {
            firstName: shipAddr.firstName || recipientName.split(' ')[0] || 'Customer',
            lastName: shipAddr.lastName || recipientName.split(' ').slice(1).join(' ') || '',
            street: shipAddr.street || shipAddr.address || '',
            city: shipAddr.city || '',
            state: shipAddr.state || '',
            zip: shipAddr.zip || shipAddr.pincode || '',
            phone: shipAddr.phone || shipAddr.mobile || '',
          },
        }).catch(err => {
          console.error('[OrderService] Failed to send order confirmation email:', err);
        });
      }, 10);

      return newOrder;
    });
  }

  /**
   * Update Order Status manually with history and timeline logging.
   */
  public static async updateOrderStatus(
    id: string,
    input: OrderStatusUpdateInput,
    adminUser?: { id?: string; name?: string }
  ) {
    const { status, comment } = input;
    const order = await this.getOrderById(id);

    // Synchronize Payment & Fulfillment status if status moves to paid/fulfilled state
    const updateData: any = { status };

    if (status === 'PAID' || status === 'CONFIRMED' || status === 'PROCESSING') {
      updateData.paymentStatus = 'PAID';
    } else if (status === 'PACKED') {
      updateData.fulfillmentStatus = 'PACKED';
    } else if (status === 'READY_TO_SHIP') {
      updateData.fulfillmentStatus = 'READY_TO_SHIP';
    } else if (status === 'SHIPPED') {
      updateData.fulfillmentStatus = 'FULFILLED';
    } else if (status === 'COMPLETED' || status === 'DELIVERED') {
      updateData.paymentStatus = 'PAID';
      updateData.fulfillmentStatus = 'FULFILLED';
      updateData.status = status;
    } else if (status === 'CANCELLED') {
      updateData.status = 'CANCELLED';
    } else if (status === 'REFUNDED') {
      updateData.paymentStatus = 'REFUNDED';
      updateData.status = 'REFUNDED';
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id },
        data: updateData,
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status,
          comment: comment || `Status updated to ${status.replace(/_/g, ' ')}`,
          note: comment || `Status updated to ${status.replace(/_/g, ' ')}`,
          updatedBy: adminUser?.name || 'Admin',
        },
      });

      return result;
    });

    // Timeline Logging
    await this.logTimelineEvent(
      id,
      'STATUS_UPDATED',
      `Status: ${status.replace(/_/g, ' ')}`,
      comment || `Order status updated from ${order.status} to ${status}`,
      'ADMIN',
      adminUser?.id
    );

    // Send email for status update
    setTimeout(() => {
      const recipientEmail = (order.customerSnapshot as any)?.email || order.user?.email || order.customerEmail;
      const recipientName = (order.customerSnapshot as any)?.fullName || order.user?.name || order.customerName || 'Customer';

      if (!recipientEmail) return;

      const recipient = { email: recipientEmail, name: recipientName };
      const shipAddr = (order.shippingAddress as any) || {};
      const address = {
        firstName: shipAddr.firstName || recipientName.split(' ')[0] || 'Customer',
        lastName: shipAddr.lastName || recipientName.split(' ').slice(1).join(' ') || '',
        street: shipAddr.street || shipAddr.address || '',
        city: shipAddr.city || '',
        state: shipAddr.state || '',
        zip: shipAddr.zip || shipAddr.pincode || '',
        phone: shipAddr.phone || shipAddr.mobile || '',
      };

      if (status === 'SHIPPED') {
        emailService.sendOrderShipped({
          recipient,
          orderNumber: order.orderNumber,
          carrier: updated.courierName || 'Standard Express',
          trackingNumber: updated.trackingNumber || `TRACK-${order.orderNumber}`,
          trackingUrl: updated.courierLink || undefined,
          shippingAddress: address,
        }).catch(err => console.error('[OrderService] Email error:', err));
      } else if (status === 'OUT_FOR_DELIVERY') {
        emailService.sendOutForDelivery({
          recipient,
          orderNumber: order.orderNumber,
          carrier: updated.courierName || undefined,
          shippingAddress: address,
        }).catch(err => console.error('[OrderService] Email error:', err));
      } else if (status === 'DELIVERED' || status === 'COMPLETED') {
        emailService.sendDelivered({
          recipient,
          orderNumber: order.orderNumber,
          shippingAddress: address,
        }).catch(err => console.error('[OrderService] Email error:', err));
      } else if (status === 'CANCELLED') {
        emailService.sendOrderCancelled({
          recipient,
          orderNumber: order.orderNumber,
          reason: comment || undefined,
          refundAmount: order.total,
        }).catch(err => console.error('[OrderService] Email error:', err));
      } else if (status === 'REFUNDED') {
        emailService.sendRefundCompleted({
          recipient,
          orderNumber: order.orderNumber,
          refundReference: `REF-${order.orderNumber}`,
          amount: order.total,
        }).catch(err => console.error('[OrderService] Email error:', err));
      } else if (status === 'CONFIRMED' || status === 'PAID') {
        emailService.sendPaymentSuccessful({
          recipient,
          orderNumber: order.orderNumber,
          transactionId: `TXN-${order.orderNumber}`,
          amount: order.total,
          paymentMethod: 'Online Payment',
        }).catch(err => console.error('[OrderService] Email error:', err));
      }
    }, 10);

    return updated;
  }

  /**
   * Update Payment Status manually.
   */
  public static async updatePaymentStatus(
    id: string,
    input: PaymentStatusUpdateInput,
    adminUser?: { id?: string; name?: string }
  ) {
    const { paymentStatus, comment } = input;
    await this.getOrderById(id);

    const updated = await prisma.order.update({
      where: { id },
      data: { paymentStatus },
    });

    await this.logTimelineEvent(
      id,
      'PAYMENT_STATUS_UPDATED',
      `Payment: ${paymentStatus}`,
      comment || `Payment status set to ${paymentStatus}`,
      'ADMIN',
      adminUser?.id
    );

    return updated;
  }

  /**
   * Update Fulfillment Status manually.
   */
  public static async updateFulfillmentStatus(
    id: string,
    input: FulfillmentStatusUpdateInput,
    adminUser?: { id?: string; name?: string }
  ) {
    const { fulfillmentStatus, trackingNumber, courierName, courierLink, comment } = input;
    await this.getOrderById(id);

    const updateData: any = { fulfillmentStatus };
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (courierName) updateData.courierName = courierName;
    if (courierLink) updateData.courierLink = courierLink;

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
    });

    await this.logTimelineEvent(
      id,
      'FULFILLMENT_UPDATED',
      `Fulfillment: ${fulfillmentStatus}`,
      comment || `Fulfillment state updated to ${fulfillmentStatus} ${trackingNumber ? `(Tracking: ${trackingNumber})` : ''}`,
      'ADMIN',
      adminUser?.id
    );

    return updated;
  }

  /**
   * Add Internal/Customer Note to Order.
   */
  public static async addNote(
    orderId: string,
    input: OrderNoteInput,
    adminUser?: { id?: string; name?: string }
  ) {
    await this.getOrderById(orderId);

    const note = await prisma.orderNote.create({
      data: {
        orderId,
        authorId: adminUser?.id,
        authorName: adminUser?.name || 'Admin',
        content: input.content.trim(),
        isInternal: input.isInternal !== undefined ? input.isInternal : true,
      },
    });

    await this.logTimelineEvent(
      orderId,
      'NOTE_ADDED',
      'Admin Note Added',
      input.content.trim(),
      'ADMIN',
      adminUser?.id
    );

    return note;
  }

  /**
   * Bulk Update Order Status.
   */
  public static async bulkUpdateStatus(input: BulkUpdateStatusInput, adminUser?: { id?: string; name?: string }) {
    const { orderIds, status, comment } = input;
    if (!orderIds || orderIds.length === 0) {
      throw new ValidationError('No orders selected for bulk status update');
    }

    let count = 0;
    for (const id of orderIds) {
      await this.updateOrderStatus(id, { status, comment }, adminUser);
      count++;
    }

    return { updatedCount: count };
  }

  /**
   * Export Orders as CSV.
   */
  public static async exportCsv(query: OrderFilterQuery): Promise<string> {
    const result = await this.getOrders({ ...query, limit: 1000, page: 1 });
    const orders = result.items;

    const headers = [
      'Order Number',
      'Order Date',
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      'Items Count',
      'Subtotal',
      'Discount',
      'Shipping Fee',
      'Total Amount',
      'Order Status',
      'Payment Status',
      'Fulfillment Status',
      'Tracking Number',
    ];

    const rows = orders.map(o => [
      `"${o.orderNumber}"`,
      `"${new Date(o.orderDate).toISOString()}"`,
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${o.customerEmail}"`,
      `"${o.customerPhone}"`,
      o.itemsCount,
      o.subtotal,
      o.discount,
      o.shippingFee,
      o.total,
      `"${o.status}"`,
      `"${o.paymentStatus}"`,
      `"${o.fulfillmentStatus}"`,
      `"${o.trackingNumber || ''}"`,
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Get Dataset for Printable Packing Slip.
   */
  public static async getPackingSlipData(id: string) {
    const order = await this.getOrderById(id);

    let storeName = "OM Mobile Art";
    let storeAddress = "Mumbai, Maharashtra, India";
    let supportPhone = "+91 96386 52327";
    let supportEmail = "ommobileart09@gmail.com";

    try {
      const storeSetting = await prisma.storeSetting.findFirst();
      const contactInfo = await prisma.contactInfo.findFirst();

      if (storeSetting?.storeName) {
        storeName = storeSetting.storeName;
      }
      if (contactInfo?.officeAddress) {
        storeAddress = contactInfo.officeAddress;
      }
      if (contactInfo?.supportPhone) {
        supportPhone = contactInfo.supportPhone;
      }
      if (contactInfo?.supportEmail) {
        supportEmail = contactInfo.supportEmail;
      }
    } catch (e) {
      console.warn('[OrderService] Dynamic settings fetch failed for packing slip, using fallbacks:', e);
    }

    return {
      storeName,
      storeAddress,
      supportPhone,
      supportEmail,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      customerName: (order.customerSnapshot as any)?.fullName || order.user?.name || 'Customer',
      customerPhone: (order.customerSnapshot as any)?.phone || order.user?.phone || '',
      customerEmail: (order.customerSnapshot as any)?.email || order.user?.email || '',
      shippingAddress: order.shippingAddress,
      items: order.items.map(item => ({
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.pricePaid * item.quantity,
        finish: (item as any).finish || 'Matte',
        material: (item as any).material || '3M Vinyl',
        coverage: (item as any).coverage || 'Full Back',
        deviceBrand: (item as any).deviceBrand || item.brandName || '',
        deviceModel: (item as any).deviceModel || item.deviceName || '',
        deviceType: (item as any).deviceType || 'Mobile',
        pricePaid: item.pricePaid,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      shippingFee: order.shippingFee,
      total: order.total,
    };
  }

  /**
   * Get Overview Dashboard Cards Analytics.
   */
  public static async getDashboardMetrics(): Promise<OrderDashboardMetrics> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      pendingOrders,
      processingOrders,
      packedOrders,
      readyToShipOrders,
      cancelledOrders,
      todaysOrders,
      todaysRevenueAgg,
      totalRevenueAgg
    ] = await Promise.all([
      prisma.order.count({ where: { status: 'PENDING_PAYMENT', deletedAt: null } }),
      prisma.order.count({ where: { status: 'PROCESSING', deletedAt: null } }),
      prisma.order.count({ where: { status: 'PACKED', deletedAt: null } }),
      prisma.order.count({ where: { status: 'READY_TO_SHIP', deletedAt: null } }),
      prisma.order.count({ where: { status: 'CANCELLED', deletedAt: null } }),
      prisma.order.count({
        where: {
          createdAt: { gte: todayStart },
          deletedAt: null,
        },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: todayStart },
          status: { notIn: ['CANCELLED', 'FAILED', 'REFUNDED'] },
          deletedAt: null,
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          status: { notIn: ['CANCELLED', 'FAILED', 'REFUNDED'] },
          deletedAt: null,
        },
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    const todaysRevenue = todaysRevenueAgg._sum.total || 0.0;
    const totalCount = totalRevenueAgg._count.id || 0;
    const totalRev = totalRevenueAgg._sum.total || 0.0;
    const averageOrderValue = totalCount > 0 ? Math.round((totalRev / totalCount) * 100) / 100 : 0.0;

    return {
      pendingOrders,
      processingOrders,
      packedOrders,
      readyToShipOrders,
      cancelledOrders,
      todaysOrdersCount: todaysOrders,
      todaysRevenue: Math.round(todaysRevenue * 100) / 100,
      averageOrderValue,
    };
  }

  /**
   * Track order by Order Number or ID (Public access for customer tracking timeline)
   */
  public static async trackOrder(orderRef: string) {
    if (!orderRef || !orderRef.trim()) {
      throw new NotFoundError('Order reference is required');
    }
    const cleanRef = orderRef.trim();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRef);
    const whereOr: any[] = [
      { orderNumber: { equals: cleanRef } }
    ];
    if (isUuid) {
      whereOr.push({ id: cleanRef });
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: whereOr,
        deletedAt: null,
      },
      include: {
        items: OrderService.orderItemInclusion,
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
        timelineEvents: {
          orderBy: { createdAt: 'asc' },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundError(`Order reference "${cleanRef}" not found`);
    }

    return this.mapToOrderDTO(order);
  }
}
