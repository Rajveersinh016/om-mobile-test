import { prisma } from '../../../database/client.js';
import { Prisma, Product, ProductVariant, ProductImage } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { ValidationError, NotFoundError } from '../../../core/exceptions/exceptions.js';
import { logger } from '../../../services/logger.js';

export class ProductRepository {
  async findMany(
    where: Prisma.ProductWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.ProductOrderByWithRelationInput
  ): Promise<Product[]> {
    return prisma.product.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        category: true,
        collections: true,
        variants: true,
        productType: true,
        devicePrices: {
          include: {
            deviceType: true,
          },
        },
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
    });
  }

  async count(where: Prisma.ProductWhereInput): Promise<number> {
    return prisma.product.count({
      where,
    });
  }

  async findById(id: string): Promise<any> {
    return prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        collections: true,
        productType: true,
        images: {
          orderBy: { position: 'asc' },
        },
        variants: true,
        devicePrices: {
          include: {
            deviceType: true
          }
        },
        models: {
          include: {
            brand: {
              include: {
                deviceType: true
              }
            },
            series: {
              include: {
                brand: {
                  include: {
                    deviceType: true
                  }
                }
              }
            }
          }
        }
      },
    }) as any;
  }

  async findBySlug(slug: string): Promise<any> {
    return prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        collections: true,
        productType: true,
        images: {
          orderBy: { position: 'asc' },
        },
        variants: true,
        devicePrices: {
          include: {
            deviceType: true
          }
        },
        models: {
          include: {
            brand: {
              include: {
                deviceType: true
              }
            },
            series: {
              include: {
                brand: {
                  include: {
                    deviceType: true
                  }
                }
              }
            }
          }
        }
      },
    }) as any;
  }

  async findVariantBySku(sku: string): Promise<ProductVariant | null> {
    return prisma.productVariant.findUnique({
      where: { sku },
    });
  }

  async findVariantById(id: string): Promise<ProductVariant | null> {
    return prisma.productVariant.findUnique({
      where: { id },
    });
  }

  async create(
    productData: Prisma.ProductCreateInput,
    variantsData: Omit<Prisma.ProductVariantCreateManyProductInput, 'id' | 'productId' | 'createdAt' | 'updatedAt'>[],
    imagesData: Omit<Prisma.ProductImageCreateManyProductInput, 'id' | 'productId' | 'createdAt' | 'updatedAt'>[],
    devicePricesData?: { deviceTypeId: string; price: number }[]
  ): Promise<Product> {
    return prisma.$transaction(async (tx) => {
      // Create product
      const product = await tx.product.create({
        data: {
          ...productData,
        },
      });

      // Create variants
      if (variantsData.length > 0) {
        await tx.productVariant.createMany({
          data: variantsData.map((v) => ({
            ...v,
            productId: product.id,
          })),
        });
      }

      // Create images
      if (imagesData.length > 0) {
        await tx.productImage.createMany({
          data: imagesData.map((img) => ({
            ...img,
            productId: product.id,
          })),
        });
      }

      // Create device prices
      if (devicePricesData && devicePricesData.length > 0) {
        await tx.productDevicePrice.createMany({
          data: devicePricesData.map((dp) => ({
            productId: product.id,
            deviceTypeId: dp.deviceTypeId,
            price: dp.price,
          })),
        });
      }

      return product;
    });
  }

  async update(
    id: string,
    productData: Prisma.ProductUpdateInput,
    variantsData?: (Partial<Prisma.ProductVariantCreateInput> & { id?: string; sku: string })[],
    imagesData?: Omit<Prisma.ProductImageCreateManyProductInput, 'id' | 'productId' | 'createdAt' | 'updatedAt'>[],
    devicePricesData?: { deviceTypeId: string; price: number }[]
  ): Promise<Product> {
    return prisma.$transaction(async (tx) => {
      // Update basic product details
      const product = await tx.product.update({
        where: { id },
        data: productData,
      });

      // Update variants if provided
      if (variantsData) {
        // Fetch existing variants to know if we should remove any omitted ones (only if not restricted)
        const existingVariants = await tx.productVariant.findMany({
          where: { productId: id },
        });
        
        const providedIds = variantsData.filter((v) => v.id).map((v) => v.id!);
        const toDeleteIds = existingVariants
          .filter((v) => !providedIds.includes(v.id))
          .map((v) => v.id);

        if (toDeleteIds.length > 0) {
          await tx.productVariant.deleteMany({
            where: {
              id: { in: toDeleteIds },
            },
          });
        }

        for (const variant of variantsData) {
          if (variant.id) {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                sku: variant.sku,
                finish: variant.finish,
                material: variant.material,
                priceOffset: variant.priceOffset,
                stockQuantity: variant.stockQuantity,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                sku: variant.sku,
                finish: variant.finish ?? '',
                material: variant.material ?? '',
                priceOffset: variant.priceOffset ?? 0.0,
                stockQuantity: variant.stockQuantity ?? 0,
                productId: id,
              },
            });
          }
        }
      }

      // Update images if provided (delete existing ones and recreate)
      if (imagesData) {
        await tx.productImage.deleteMany({
          where: { productId: id },
        });

        if (imagesData.length > 0) {
          await tx.productImage.createMany({
            data: imagesData.map((img) => ({
              ...img,
              productId: id,
            })),
          });
        }
      }

      // Update device prices if provided
      if (devicePricesData !== undefined) {
        await tx.productDevicePrice.deleteMany({
          where: { productId: id },
        });

        if (devicePricesData.length > 0) {
          await tx.productDevicePrice.createMany({
            data: devicePricesData.map((dp) => ({
              productId: id,
              deviceTypeId: dp.deviceTypeId,
              price: dp.price,
            })),
          });
        }
      }

      return product;
    });
  }

  async publish(id: string): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: { isPublished: true },
    });
  }

  async unpublish(id: string): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: { isPublished: false },
    });
  }

  async restore(id: string, slug?: string): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: {
        deletedAt: null,
        isPublished: true,
        status: 'PUBLISHED',
        ...(slug ? { slug } : {}),
      },
    });
  }

  async softDelete(id: string): Promise<Product> {
    const res = await this.deleteProductTransaction(id);
    if (res.product) return res.product;
    
    // Return dummy object if physically deleted
    return { id, name: 'Deleted Product', deletedAt: new Date() } as any;
  }

  async permanentDelete(id: string): Promise<void> {
    await this.deleteProductTransaction(id);
  }

  /**
   * Delete a single product inside an atomic transaction.
   * If historic OrderItems exist for this product's variants, it performs a soft-delete / archival
   * to preserve order history and invoices while removing it from catalog, storefront & inventory.
   * If no historic orders exist, it performs a full cascade physical deletion.
   */
  async deleteProductTransaction(id: string): Promise<{ action: 'ARCHIVED' | 'DELETED'; product?: Product }> {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        include: {
          variants: { select: { id: true } }
        }
      });
      if (!product) {
        throw new NotFoundError(`Product with ID '${id}' not found`);
      }

      const variantIds = product.variants.map(v => v.id);

      // Check if product variants are referenced in historic orders
      const hasOrders = variantIds.length > 0 ? await tx.orderItem.findFirst({
        where: { productVariantId: { in: variantIds } }
      }) : null;

      if (hasOrders) {
        // Product has completed/existing orders: Soft-delete & Archive
        const deletedSlug = product.slug.includes('-deleted-') ? product.slug : `${product.slug}-deleted-${uuidv4().substring(0, 8)}`;
        const updated = await tx.product.update({
          where: { id },
          data: {
            deletedAt: new Date(),
            isPublished: false,
            status: 'ARCHIVED',
            slug: deletedSlug
          }
        });

        // Clean up transient non-historic records
        await tx.inventory.deleteMany({ where: { productId: id } });
        await tx.inventoryHistory.deleteMany({ where: { productId: id } });
        if (variantIds.length > 0) {
          await tx.cartItem.deleteMany({ where: { productVariantId: { in: variantIds } } });
          await tx.wishlistItem.deleteMany({ where: { productVariantId: { in: variantIds } } });
          await tx.reservationItem.deleteMany({ where: { productVariantId: { in: variantIds } } });
          await tx.stockAdjustment.deleteMany({ where: { productVariantId: { in: variantIds } } });
        }
        await tx.wishlistItem.deleteMany({ where: { productId: id } });

        return { action: 'ARCHIVED', product: updated };
      } else {
        // No orders exist: Complete cascade physical deletion
        if (variantIds.length > 0) {
          await tx.cartItem.deleteMany({ where: { productVariantId: { in: variantIds } } });
          await tx.wishlistItem.deleteMany({ where: { productVariantId: { in: variantIds } } });
          await tx.reservationItem.deleteMany({ where: { productVariantId: { in: variantIds } } });
          await tx.stockAdjustment.deleteMany({ where: { productVariantId: { in: variantIds } } });
        }
        await tx.wishlistItem.deleteMany({ where: { productId: id } });
        await tx.inventoryHistory.deleteMany({ where: { productId: id } });
        await tx.inventory.deleteMany({ where: { productId: id } });
        await tx.devicePreviewImage.deleteMany({ where: { productId: id } });
        await tx.review.deleteMany({ where: { productId: id } });
        await tx.productImage.deleteMany({ where: { productId: id } });

        // Disconnect many-to-many join tables
        await tx.product.update({
          where: { id },
          data: {
            models: { set: [] },
            collections: { set: [] }
          }
        });

        await tx.productVariant.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });

        return { action: 'DELETED' };
      }
    });
  }

  /**
   * Bulk delete products atomically.
   */
  async bulkDeleteProductsTransaction(ids: string[]): Promise<{ deletedCount: number; archivedCount: number }> {
    let deletedCount = 0;
    let archivedCount = 0;

    for (const id of ids) {
      try {
        const result = await this.deleteProductTransaction(id);
        if (result.action === 'ARCHIVED') {
          archivedCount++;
        } else {
          deletedCount++;
        }
      } catch (err) {
        // Skip missing items
      }
    }

    return { deletedCount, archivedCount };
  }

  async updateVariantInventory(variantId: string, stockQuantity: number): Promise<ProductVariant> {
    return this.updateVariantInventoryTx(variantId, stockQuantity, true);
  }

  async updateVariantInventoryTx(variantId: string, quantityChange: number, absolute = false): Promise<ProductVariant> {
    return prisma.$transaction(async (tx) => {
      // 1. Pessimistic lock on the variant using raw SQL FOR UPDATE
      // This enforces ORM-centricity by isolating SQL queries strictly inside the repository
      const variants = await tx.$queryRaw<ProductVariant[]>`
        SELECT * FROM product_variants WHERE id = ${variantId} FOR UPDATE
      `;
      const variant = variants[0];
      if (!variant) {
        throw new NotFoundError('Product variant not found');
      }

      // 2. Calculate new stock level
      const newStock = absolute ? quantityChange : variant.stockQuantity + quantityChange;

      // 3. Prevent negative inventory
      if (newStock < 0) {
        logger.error(
          { variantId, sku: variant.sku, currentStock: variant.stockQuantity, quantityChange, absolute, newStock },
          'Inventory adjustment failure: Stock cannot go below zero'
        );
        throw new ValidationError('Inventory stock quantity cannot be negative');
      }

      // 4. Update and return
      return tx.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: newStock },
      });
    });
  }
}

export const productRepository = new ProductRepository();
