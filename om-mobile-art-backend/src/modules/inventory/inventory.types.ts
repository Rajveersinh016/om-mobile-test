export type StockAdjustmentType = 
  | 'INCREASE'
  | 'DECREASE'
  | 'SET'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'RESTOCK'
  | 'AUDIT'
  | 'BULK_UPDATE'
  | 'RESERVATION'
  | 'ORDER_DEDUCTION';

export interface StockAdjustmentInput {
  productVariantId: string;
  type: StockAdjustmentType;
  quantity: number;
  targetVariantId?: string; // For stock transfer
  reason: string;
  referenceNumber?: string;
  adminUserId?: string;
  adminName?: string;
}

export interface InventoryFilterQuery {
  search?: string;
  status?: 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  collectionId?: string;
  brandId?: string;
  productTypeId?: string;
  page?: number;
  limit?: number;
}

export interface BulkUpdateItem {
  productVariantId: string;
  quantity?: number;
  priceOffset?: number;
  sku?: string;
  minStockLevel?: number;
  allowBackorder?: boolean;
  reason?: string;
}

export interface CsvImportRow {
  sku: string;
  productName?: string;
  variantInfo?: string;
  quantity?: number | string;
  minStockLevel?: number | string;
  priceOffset?: number | string;
  allowBackorder?: boolean | string;
  reason?: string;
}
