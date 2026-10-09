import { FastifyRequest, FastifyReply } from 'fastify';
import { InventoryService } from './inventory.service.js';
import { InventoryFilterQuery, StockAdjustmentInput, BulkUpdateItem } from './inventory.types.js';

export class InventoryController {
  public static async getDashboardStats(_request: any, reply: any) {
    const stats = await InventoryService.getDashboardStats();
    return reply.send({
      success: true,
      data: stats,
    });
  }

  public static async getInventoryList(request: any, reply: any) {
    const query: InventoryFilterQuery = request.query || {};
    const result = await InventoryService.getInventoryList(query);
    return reply.send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  }

  public static async adjustStock(request: any, reply: any) {
    const user = request.user;
    const input: StockAdjustmentInput = {
      ...request.body,
      adminUserId: user?.id,
      adminName: user?.name || user?.email || 'Admin',
    };

    const result = await InventoryService.adjustStock(input);
    return reply.send({
      success: true,
      message: 'Stock adjusted successfully',
      data: result,
    });
  }

  public static async getHistory(request: any, reply: any) {
    const { variantId } = request.params || {};
    const limit = Number(request.query?.limit) || 50;
    const history = await InventoryService.getHistory(variantId, limit);
    return reply.send({
      success: true,
      data: history,
    });
  }

  public static async bulkUpdate(request: any, reply: any) {
    const user = request.user;
    const adminUser = user ? { id: user.id, name: user.name || user.email } : undefined;
    const items: BulkUpdateItem[] = request.body?.items || [];
    const result = await InventoryService.bulkUpdate(items, adminUser);
    return reply.send({
      success: true,
      message: `${result.updatedCount} items updated successfully`,
      data: result,
    });
  }

  public static async importCsv(request: any, reply: any) {
    const user = request.user;
    const adminUser = user ? { id: user.id, name: user.name || user.email } : undefined;
    const csvContent = request.body?.csvContent || '';
    const result = await InventoryService.importCsv(csvContent, adminUser);
    return reply.send({
      success: true,
      message: 'CSV stock import completed successfully',
      data: result,
    });
  }

  public static async exportCsv(_request: any, reply: any) {
    const csvData = await InventoryService.exportCsv();
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="inventory-export.csv"');
    return reply.send(csvData);
  }

  public static async bulkGenerateSkus(_request: any, reply: any) {
    const result = await InventoryService.bulkGenerateSkus();
    return reply.send({
      success: true,
      message: `Bulk SKU generation completed. ${result.updatedCount} SKUs updated.`,
      data: result,
    });
  }
}
