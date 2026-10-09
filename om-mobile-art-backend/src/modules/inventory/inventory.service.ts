import { prisma } from '../../database/client.js';
import { 
  InventoryFilterQuery, 
  StockAdjustmentInput, 
  BulkUpdateItem, 
  CsvImportRow 
} from './inventory.types.js';
import { AppError } from '../../core/exceptions/exceptions.js';

export class InventoryService {
  /**
   * Syncs existing ProductVariants with Inventory records so that
   * every single variant in PostgreSQL has an active Inventory row.
   */
  public static async syncInventories(): Promise<void> {
    try {
      const variantsWithoutInventory = await prisma.productVariant.findMany({
        where: {
          inventory: null,
          product: {
            deletedAt: null,
          },
        },
        include: {
          product: true,
        },
      });

      if (variantsWithoutInventory.length === 0) return;

      for (const variant of variantsWithoutInventory) {
        try {
          await prisma.inventory.upsert({
            where: { productVariantId: variant.id },
            create: {
              productId: variant.productId,
              productVariantId: variant.id,
              sku: variant.sku,
              quantity: variant.stockQuantity || 0,
              reserved: variant.reservedStock || 0,
              incoming: 0,
              minStockLevel: variant.product?.lowStockThreshold ?? 5,
              maxStockLevel: 100,
              safetyStock: 2,
              allowBackorder: variant.product?.allowBackorder ?? false,
            },
            update: {},
          });
        } catch (err) {
          const safeSku = `${variant.sku}-${variant.id.slice(0, 6)}`;
          await prisma.inventory.create({
            data: {
              productId: variant.productId,
              productVariantId: variant.id,
              sku: safeSku,
              quantity: variant.stockQuantity || 0,
              reserved: variant.reservedStock || 0,
              incoming: 0,
              minStockLevel: variant.product?.lowStockThreshold ?? 5,
              maxStockLevel: 100,
              safetyStock: 2,
              allowBackorder: variant.product?.allowBackorder ?? false,
            },
          }).catch(() => null);
        }
      }
    } catch (err) {
      console.warn('[Inventory Sync Warning] Non-fatal inventory sync error handled:', err);
    }
  }

  /**
   * Helper to ensure a specific variant has an inventory record created.
   */
  public static async ensureInventoryRecord(variantId: string) {
    let inventory = await prisma.inventory.findUnique({
      where: { productVariantId: variantId },
    });

    if (!inventory) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true },
      });

      if (!variant) {
        throw new AppError('Product variant not found', 404, 'NOT_FOUND');
      }

      try {
        inventory = await prisma.inventory.create({
          data: {
            productId: variant.productId,
            productVariantId: variant.id,
            sku: variant.sku,
            quantity: variant.stockQuantity || 0,
            reserved: variant.reservedStock || 0,
            minStockLevel: variant.product?.lowStockThreshold ?? 5,
            allowBackorder: variant.product?.allowBackorder ?? false,
          },
        });
      } catch (err) {
        const safeSku = `${variant.sku}-${variant.id.slice(0, 6)}`;
        inventory = await prisma.inventory.create({
          data: {
            productId: variant.productId,
            productVariantId: variant.id,
            sku: safeSku,
            quantity: variant.stockQuantity || 0,
            reserved: variant.reservedStock || 0,
            minStockLevel: variant.product?.lowStockThreshold ?? 5,
            allowBackorder: variant.product?.allowBackorder ?? false,
          },
        });
      }
    }

    return inventory;
  }

  /**
   * Get overall Dashboard Summary Stats.
   */
  public static async getDashboardStats() {
    await this.syncInventories();

    const [
      totalProducts,
      totalVariants,
      inventories,
      twentyFourHoursAgoCount
    ] = await Promise.all([
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.productVariant.count({ where: { product: { deletedAt: null } } }),
      prisma.inventory.findMany({
        where: {
          product: {
            deletedAt: null,
          },
        },
        include: {
          variant: true,
          product: true,
        },
      }),
      prisma.inventoryHistory.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          product: {
            deletedAt: null,
          },
        },
      }),
    ]);

    let totalStockUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalInventoryValue = 0;

    for (const inv of inventories) {
      const available = inv.quantity - inv.reserved;
      totalStockUnits += inv.quantity;

      if (available <= 0) {
        outOfStockCount++;
      } else if (available <= inv.minStockLevel) {
        lowStockCount++;
      }

      const basePrice = inv.product.price || 0;
      const offset = inv.variant.priceOffset || 0;
      const unitPrice = basePrice + offset;
      totalInventoryValue += unitPrice * inv.quantity;
    }

    // Get recently updated history entries (last 5)
    const recentlyUpdated = await prisma.inventoryHistory.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true, image: true } },
        variant: { select: { sku: true, finish: true, material: true } },
      },
    });

    return {
      totalProducts,
      totalVariants,
      totalStockUnits,
      lowStockCount,
      outOfStockCount,
      recentlyUpdatedCount: twentyFourHoursAgoCount,
      inventoryValue: Math.round(totalInventoryValue * 100) / 100,
      recentlyUpdated,
    };
  }

  /**
   * List Inventory items with filters, search, and pagination.
   */
  public static async getInventoryList(query: InventoryFilterQuery) {
    await this.syncInventories();

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = {
      product: {
        deletedAt: null,
      },
    };

    // Search filter
    if (query.search && query.search.trim() !== '') {
      const term = query.search.trim();
      whereClause.OR = [
        { sku: { contains: term } },
        { barcode: { contains: term } },
        { product: { name: { contains: term } } },
        { variant: { finish: { contains: term } } },
        { variant: { material: { contains: term } } },
      ];
    }

    // Collection filter
    if (query.collectionId) {
      whereClause.product.collections = {
        some: { id: query.collectionId },
      };
    }

    // Product Type filter
    if (query.productTypeId) {
      whereClause.product.productTypeId = query.productTypeId;
    }

    const allMatching = await prisma.inventory.findMany({
      where: whereClause,
      include: {
        product: {
          include: {
            category: true,
            productType: true,
            collections: true,
            models: {
              include: {
                brand: true,
              },
            },
          },
        },
        variant: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Apply Brand filter if requested (via models relation)
    let filtered = allMatching;
    if (query.brandId) {
      filtered = filtered.filter(inv =>
        inv.product.models.some(m => m.brandId === query.brandId)
      );
    }

    // Apply Stock Status Filter
    if (query.status && query.status !== 'ALL') {
      filtered = filtered.filter(inv => {
        const available = inv.quantity - inv.reserved;
        if (query.status === 'OUT_OF_STOCK') {
          return available <= 0;
        }
        if (query.status === 'LOW_STOCK') {
          return available > 0 && available <= inv.minStockLevel;
        }
        if (query.status === 'IN_STOCK') {
          return available > inv.minStockLevel;
        }
        return true;
      });
    }

    const totalItems = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    const items = paginated.map(inv => {
      const available = Math.max(0, inv.quantity - inv.reserved);
      let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (available <= 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (available <= inv.minStockLevel) {
        stockStatus = 'LOW_STOCK';
      }

      // Brands list
      const brands = Array.from(
        new Set(inv.product.models.map(m => m.brand?.name).filter(Boolean))
      );

      return {
        id: inv.id,
        productId: inv.productId,
        productName: inv.product.name,
        productImage: inv.product.image,
        productStatus: inv.product.status,
        categoryName: inv.product.category?.name,
        productTypeName: inv.product.productType?.name,
        collections: inv.product.collections.map(c => c.name),
        brands,
        productVariantId: inv.productVariantId,
        variantFinish: inv.variant.finish,
        variantMaterial: inv.variant.material,
        variantPriceOffset: inv.variant.priceOffset,
        totalPrice: inv.product.price + inv.variant.priceOffset,
        sku: inv.sku,
        barcode: inv.barcode,
        hsnCode: inv.hsnCode,
        quantity: inv.quantity,
        reserved: inv.reserved,
        available,
        incoming: inv.incoming,
        minStockLevel: inv.minStockLevel,
        maxStockLevel: inv.maxStockLevel,
        safetyStock: inv.safetyStock,
        allowBackorder: inv.allowBackorder,
        stockStatus,
        updatedAt: inv.updatedAt,
      };
    });

    return {
      items,
      pagination: {
        total: totalItems,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit) || 1,
      },
    };
  }

  /**
   * Adjust Stock for a variant (Increase, Decrease, Set Exact, Transfer, Custom Reason).
   */
  public static async adjustStock(input: StockAdjustmentInput) {
    const {
      productVariantId,
      type,
      quantity,
      targetVariantId,
      reason,
      referenceNumber,
      adminUserId,
      adminName,
    } = input;

    if (!reason || reason.trim() === '') {
      throw new AppError('Reason is required for all stock operations', 400, 'BAD_REQUEST');
    }

    if (isNaN(quantity) || quantity < 0) {
      throw new AppError('Quantity must be a non-negative number', 400, 'BAD_REQUEST');
    }

    const inventory = await this.ensureInventoryRecord(productVariantId);
    const oldQty = inventory.quantity;
    let newQty = oldQty;

    if (type === 'INCREASE' || type === 'RESTOCK') {
      newQty = oldQty + quantity;
    } else if (type === 'DECREASE' || type === 'DAMAGE') {
      newQty = oldQty - quantity;
    } else if (type === 'SET' || type === 'AUDIT' || type === 'ADJUSTMENT' || type === 'BULK_UPDATE') {
      newQty = quantity;
    } else if (type === 'TRANSFER') {
      if (!targetVariantId) {
        throw new AppError('Target variant ID is required for stock transfer', 400, 'BAD_REQUEST');
      }
      if (targetVariantId === productVariantId) {
        throw new AppError('Cannot transfer stock to the same variant', 400, 'BAD_REQUEST');
      }
      newQty = oldQty - quantity;
    }

    // Negative stock prevention unless backorder is explicitly allowed
    if (newQty < 0 && !inventory.allowBackorder) {
      throw new AppError(
        `Operation failed: Stock quantity cannot be negative (${newQty}). Backorders are disabled for this variant.`,
        400,
        'NEGATIVE_STOCK_DISALLOWED'
      );
    }

    const difference = newQty - oldQty;

    // Execute database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Inventory
      const updatedInv = await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: newQty },
      });

      // 2. Sync ProductVariant
      await tx.productVariant.update({
        where: { id: productVariantId },
        data: { stockQuantity: newQty },
      });

      // 3. Create Audit History Log
      const history = await tx.inventoryHistory.create({
        data: {
          inventoryId: inventory.id,
          productId: inventory.productId,
          productVariantId: inventory.productVariantId,
          oldQuantity: oldQty,
          newQuantity: newQty,
          difference,
          reason: reason.trim(),
          actionType: type,
          adminUserId: adminUserId || null,
          adminName: adminName || 'Admin',
        },
      });

      // 4. Create Stock Adjustment Record
      await tx.stockAdjustment.create({
        data: {
          inventoryId: inventory.id,
          productVariantId: inventory.productVariantId,
          type,
          quantity: Math.abs(difference),
          reason: reason.trim(),
          referenceNumber: referenceNumber || null,
          performedById: adminUserId || null,
        },
      });

      // Handle Transfer target variant if applicable
      if (type === 'TRANSFER' && targetVariantId) {
        const targetInv = await this.ensureInventoryRecord(targetVariantId);
        const targetOldQty = targetInv.quantity;
        const targetNewQty = targetOldQty + quantity;

        await tx.inventory.update({
          where: { id: targetInv.id },
          data: { quantity: targetNewQty },
        });

        await tx.productVariant.update({
          where: { id: targetVariantId },
          data: { stockQuantity: targetNewQty },
        });

        await tx.inventoryHistory.create({
          data: {
            inventoryId: targetInv.id,
            productId: targetInv.productId,
            productVariantId: targetInv.productVariantId,
            oldQuantity: targetOldQty,
            newQuantity: targetNewQty,
            difference: quantity,
            reason: `Transfer received from SKU ${inventory.sku}: ${reason.trim()}`,
            actionType: 'TRANSFER',
            adminUserId: adminUserId || null,
            adminName: adminName || 'Admin',
          },
        });

        await tx.stockAdjustment.create({
          data: {
            inventoryId: targetInv.id,
            productVariantId: targetInv.productVariantId,
            type: 'TRANSFER',
            quantity,
            reason: `Transfer received from SKU ${inventory.sku}: ${reason.trim()}`,
            referenceNumber: referenceNumber || null,
            performedById: adminUserId || null,
          },
        });
      }

      return { updatedInv, history };
    });

    return result;
  }

  /**
   * Get Inventory History for a variant or all variants.
   */
  public static async getHistory(productVariantId?: string, limit: number = 50) {
    const where: any = {};
    if (productVariantId) {
      where.productVariantId = productVariantId;
    }

    const histories = await prisma.inventoryHistory.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, image: true } },
        variant: { select: { id: true, sku: true, finish: true, material: true } },
      },
    });

    return histories;
  }

  /**
   * Bulk Update Inventory & Pricing.
   */
  public static async bulkUpdate(items: BulkUpdateItem[], adminUser?: { id?: string; name?: string }) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError('No items provided for bulk update', 400, 'BAD_REQUEST');
    }

    const results = [];
    for (const item of items) {
      if (!item.productVariantId) continue;

      const inventory = await this.ensureInventoryRecord(item.productVariantId);

      // Update basic fields if provided
      if (item.minStockLevel !== undefined || item.allowBackorder !== undefined || item.sku) {
        const updateData: any = {};
        if (item.minStockLevel !== undefined) updateData.minStockLevel = Number(item.minStockLevel);
        if (item.allowBackorder !== undefined) updateData.allowBackorder = Boolean(item.allowBackorder);
        if (item.sku && item.sku.trim() !== '') {
          const skuTrimmed = item.sku.trim();
          // Check uniqueness
          const existing = await prisma.inventory.findFirst({
            where: {
              sku: skuTrimmed,
              id: { not: inventory.id },
            },
          });
          if (existing) {
            throw new AppError(`Duplicate SKU error: ${skuTrimmed} already exists`, 400, 'DUPLICATE_SKU');
          }
          updateData.sku = skuTrimmed;
          await prisma.productVariant.update({
            where: { id: item.productVariantId },
            data: { sku: skuTrimmed },
          });
        }

        await prisma.inventory.update({
          where: { id: inventory.id },
          data: updateData,
        });
      }

      // Update price offset if provided
      if (item.priceOffset !== undefined) {
        await prisma.productVariant.update({
          where: { id: item.productVariantId },
          data: { priceOffset: Number(item.priceOffset) },
        });
      }

      // Update quantity if provided
      if (item.quantity !== undefined && Number(item.quantity) !== inventory.quantity) {
        const res = await this.adjustStock({
          productVariantId: item.productVariantId,
          type: 'BULK_UPDATE',
          quantity: Number(item.quantity),
          reason: item.reason || 'Bulk stock update',
          adminUserId: adminUser?.id,
          adminName: adminUser?.name,
        });
        results.push(res);
      }
    }

    return { updatedCount: items.length };
  }

  /**
   * Import CSV Inventory data.
   */
  public static async importCsv(csvText: string, adminUser?: { id?: string; name?: string }) {
    if (!csvText || csvText.trim() === '') {
      throw new AppError('CSV data cannot be empty', 400, 'BAD_REQUEST');
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) {
      throw new AppError('CSV file has no data rows', 400, 'BAD_REQUEST');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    
    const skuIdx = headers.findIndex(h => h === 'sku');
    const qtyIdx = headers.findIndex(h => h === 'quantity' || h === 'qty' || h === 'current stock');
    const minStockIdx = headers.findIndex(h => h === 'minstocklevel' || h === 'min stock' || h === 'threshold');
    const priceOffsetIdx = headers.findIndex(h => h === 'priceoffset' || h === 'price offset');
    const allowBackorderIdx = headers.findIndex(h => h === 'allowbackorder' || h === 'backorder');

    if (skuIdx === -1) {
      throw new AppError('CSV missing required header: "SKU"', 400, 'BAD_REQUEST');
    }

    const updates: BulkUpdateItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/['"]/g, ''));
      const sku = cols[skuIdx];
      if (!sku) continue;

      const variant = await prisma.productVariant.findUnique({
        where: { sku },
      });

      if (!variant) continue;

      const item: BulkUpdateItem = {
        productVariantId: variant.id,
        sku,
        reason: 'CSV Bulk Import',
      };

      if (qtyIdx !== -1 && cols[qtyIdx] !== undefined && cols[qtyIdx] !== '') {
        const parsed = parseInt(cols[qtyIdx], 10);
        if (!isNaN(parsed)) item.quantity = parsed;
      }

      if (minStockIdx !== -1 && cols[minStockIdx] !== undefined && cols[minStockIdx] !== '') {
        const parsed = parseInt(cols[minStockIdx], 10);
        if (!isNaN(parsed)) item.minStockLevel = parsed;
      }

      if (priceOffsetIdx !== -1 && cols[priceOffsetIdx] !== undefined && cols[priceOffsetIdx] !== '') {
        const parsed = parseFloat(cols[priceOffsetIdx]);
        if (!isNaN(parsed)) item.priceOffset = parsed;
      }

      if (allowBackorderIdx !== -1 && cols[allowBackorderIdx] !== undefined) {
        const val = cols[allowBackorderIdx].toLowerCase();
        item.allowBackorder = val === 'true' || val === '1' || val === 'yes';
      }

      updates.push(item);
    }

    if (updates.length === 0) {
      throw new AppError('No matching variants found for the SKUs in the CSV file', 400, 'NOT_FOUND');
    }

    return await this.bulkUpdate(updates, adminUser);
  }

  /**
   * Export all Inventory data as CSV string.
   */
  public static async exportCsv(): Promise<string> {
    await this.syncInventories();

    const inventories = await prisma.inventory.findMany({
      include: {
        product: { select: { name: true, price: true } },
        variant: { select: { finish: true, material: true, priceOffset: true } },
      },
      orderBy: { sku: 'asc' },
    });

    const headers = [
      'SKU',
      'Product Name',
      'Variant Finish',
      'Variant Material',
      'Base Price',
      'Price Offset',
      'Total Price',
      'Current Stock',
      'Reserved Stock',
      'Available Stock',
      'Min Stock Level',
      'Allow Backorder',
      'Barcode',
      'HSN Code',
    ];

    const rows = inventories.map(inv => {
      const available = Math.max(0, inv.quantity - inv.reserved);
      const totalPrice = inv.product.price + inv.variant.priceOffset;
      return [
        `"${inv.sku}"`,
        `"${inv.product.name.replace(/"/g, '""')}"`,
        `"${inv.variant.finish.replace(/"/g, '""')}"`,
        `"${inv.variant.material.replace(/"/g, '""')}"`,
        inv.product.price,
        inv.variant.priceOffset,
        totalPrice,
        inv.quantity,
        inv.reserved,
        available,
        inv.minStockLevel,
        inv.allowBackorder ? 'TRUE' : 'FALSE',
        `"${inv.barcode || ''}"`,
        `"${inv.hsnCode || ''}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Bulk Generate SKUs for variants that missing unique SKUs.
   */
  public static async bulkGenerateSkus(): Promise<{ updatedCount: number }> {
    const variants = await prisma.productVariant.findMany({
      include: { product: true },
    });

    let updatedCount = 0;
    for (const variant of variants) {
      const currentSku = variant.sku;
      // If SKU is generic or missing format
      if (!currentSku || currentSku.trim() === '' || currentSku.startsWith('SKU-')) {
        const prodPrefix = variant.product.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'OMA';
        const finishPrefix = variant.finish.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'VAR';
        const randomNum = Math.floor(100 + Math.random() * 900);
        const newSku = `OMA-${prodPrefix}-${finishPrefix}-${randomNum}`;

        await prisma.productVariant.update({
          where: { id: variant.id },
          data: { sku: newSku },
        });

        await prisma.inventory.updateMany({
          where: { productVariantId: variant.id },
          data: { sku: newSku },
        });

        updatedCount++;
      }
    }

    return { updatedCount };
  }

  /**
   * API Helper for Future Orders: Reserve Stock.
   */
  public static async reserveStock(productVariantId: string, quantity: number) {
    const inv = await this.ensureInventoryRecord(productVariantId);
    const available = inv.quantity - inv.reserved;

    if (available < quantity && !inv.allowBackorder) {
      throw new AppError(`Insufficient stock available for reservation. Available: ${available}`, 400, 'INSUFFICIENT_STOCK');
    }

    const updated = await prisma.inventory.update({
      where: { id: inv.id },
      data: { reserved: inv.reserved + quantity },
    });

    await prisma.productVariant.update({
      where: { id: productVariantId },
      data: { reservedStock: inv.reserved + quantity },
    });

    return updated;
  }

  /**
   * API Helper for Future Orders: Deduct Stock upon order confirmation.
   */
  public static async deductStockForOrder(productVariantId: string, quantity: number, orderNumber: string) {
    const inv = await this.ensureInventoryRecord(productVariantId);
    const oldQty = inv.quantity;
    const newQty = oldQty - quantity;
    const newReserved = Math.max(0, inv.reserved - quantity);

    if (newQty < 0 && !inv.allowBackorder) {
      throw new AppError(`Stock deduction failed for order ${orderNumber}. Cannot set negative stock.`, 400, 'STOCK_DEDUCTION_FAILED');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.inventory.update({
        where: { id: inv.id },
        data: {
          quantity: newQty,
          reserved: newReserved,
        },
      });

      await tx.productVariant.update({
        where: { id: productVariantId },
        data: {
          stockQuantity: newQty,
          reservedStock: newReserved,
        },
      });

      await tx.inventoryHistory.create({
        data: {
          inventoryId: inv.id,
          productId: inv.productId,
          productVariantId: inv.productVariantId,
          oldQuantity: oldQty,
          newQuantity: newQty,
          difference: -quantity,
          reason: `Automatic Order Deduction: #${orderNumber}`,
          actionType: 'ORDER_DEDUCTION',
          adminName: 'System Order Engine',
        },
      });

      return updated;
    });

    return result;
  }
}
