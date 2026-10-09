import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== INSPECTING ORDER OMA2610000017 ===\n');

  const order = await prisma.order.findFirst({
    where: { orderNumber: 'OMA2610000017' },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  images: true,
                  models: {
                    include: {
                      brand: {
                        include: {
                          deviceType: true
                        }
                      }
                    }
                  },
                  devicePrices: {
                    include: {
                      deviceType: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      user: true
    }
  });

  if (!order) {
    console.log('Order OMA2610000017 not found! Listing latest 5 orders:');
    const latestOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, orderNumber: true, createdAt: true, status: true, total: true }
    });
    console.log(JSON.stringify(latestOrders, null, 2));
    return;
  }

  console.log('ORDER:');
  const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
  console.log({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: payment?.paymentMethod || 'COD',
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    total: order.total,
    createdAt: order.createdAt,
  });

  console.log('\nORDER ITEMS:');
  for (const item of order.items) {
    const variant = item.variant;
    const product = variant?.product;
    const model = product?.models?.find((m: any) => m.name.toLowerCase() === (item.deviceModel || '').toLowerCase()) || product?.models?.[0];
    const brand = model?.brand;
    const deviceType = brand?.deviceType;

    console.log({
      orderItem: {
        id: item.id,
        productId: variant?.productId || null,
        productNameSnapshot: item.productName,
        sku: item.sku,
        productVariantId: item.productVariantId,
        deviceTypeId: deviceType?.id || null,
        modelId: model?.id || null,
        imageUrlSnapshot: item.imageUrl,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      },
      product: product ? {
        id: product.id,
        name: product.name,
        sku: product.sku,
        primaryImage: product.image,
        galleryImages: product.images?.map((img: any) => img.url) || [],
      } : null,
      deviceType: deviceType ? {
        id: deviceType.id,
        name: deviceType.name,
        slug: deviceType.slug,
      } : null,
      model: model ? {
        id: model.id,
        name: model.name,
      } : null,
      variant: variant ? {
        id: variant.id,
        name: `${variant.finish} / ${variant.material}`,
        sku: variant.sku,
      } : null,
    });

    console.log('\n[ORDER IMAGE DEBUG]', {
      orderItemId: item.id,
      productId: variant?.productId || null,
      snapshotImageExists: Boolean(item.imageUrl),
      productImageExists: Boolean(product?.image),
      resolvedImageUrl: item.imageUrl || product?.image || product?.images?.[0]?.url || null,
    });
  }

  const { OrderService } = await import('../modules/order/order.service.js');
  const orderDTO = await OrderService.getOrderById(order.id);
  console.log('\n=== ORDER DTO RETURNED TO ADMIN API ===');
  console.log('DTO items:', JSON.stringify(orderDTO.items, null, 2));
}

main().finally(() => prisma.$disconnect());


