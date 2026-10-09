import { Prisma } from '@prisma/client';

export class OrderNumberService {
  async generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const prefix = process.env.ORDER_PREFIX || 'OMA';
    
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${yy}${mm}`;

    // Atomically upsert and increment the count using raw SQL to prevent race conditions
    await tx.$executeRaw`
      INSERT INTO order_counters (\`yearMonth\`, \`count\`)
      VALUES (${yearMonth}, 1)
      ON DUPLICATE KEY UPDATE \`count\` = \`count\` + 1
    `;

    const result = await tx.$queryRaw<[{ count: number }]>`
      SELECT \`count\` FROM order_counters WHERE \`yearMonth\` = ${yearMonth}
    `;

    const count = result[0].count;
    const sequentialStr = String(count).padStart(6, '0');
    return `${prefix}${yearMonth}${sequentialStr}`;
  }
}

export const orderNumberService = new OrderNumberService();
