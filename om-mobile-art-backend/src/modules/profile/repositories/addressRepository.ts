import { prisma } from '../../../database/client.js';
import { Address, Prisma } from '@prisma/client';
import { NotFoundError } from '../../../core/exceptions/exceptions.js';

export class AddressRepository {
  async findById(id: string, userId: string): Promise<Address | null> {
    return prisma.address.findFirst({
      where: {
        id,
        userId,
      },
    });
  }

  async findAllByUserId(userId: string): Promise<Address[]> {
    return prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: Omit<Prisma.AddressCreateInput, 'user'>): Promise<Address> {
    return prisma.$transaction(async (tx) => {
      // If this address is set as default shipping, unset previous ones
      if (data.isDefaultShipping) {
        await tx.address.updateMany({
          where: { userId, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
      }

      // If this address is set as default billing, unset previous ones
      if (data.isDefaultBilling) {
        await tx.address.updateMany({
          where: { userId, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
      }

      // If this is the customer's first address, make it the default for both automatically
      const addressCount = await tx.address.count({ where: { userId } });
      if (addressCount === 0) {
        data.isDefaultShipping = true;
        data.isDefaultBilling = true;
      }

      return tx.address.create({
        data: {
          ...data,
          user: { connect: { id: userId } },
        },
      });
    });
  }

  async update(id: string, userId: string, data: Prisma.AddressUpdateInput): Promise<Address> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: { id, userId },
      });
      if (!existing) {
        throw new NotFoundError('Address not found');
      }

      if (data.isDefaultShipping === true) {
        await tx.address.updateMany({
          where: { userId, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
      }

      if (data.isDefaultBilling === true) {
        await tx.address.updateMany({
          where: { userId, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
      }

      return tx.address.update({
        where: { id },
        data,
      });
    });
  }

  async delete(id: string, userId: string): Promise<Address> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: { id, userId },
      });
      if (!existing) {
        throw new NotFoundError('Address not found');
      }

      await tx.address.delete({
        where: { id },
      });

      // If we deleted a default address, promote another address if available
      if (existing.isDefaultShipping || existing.isDefaultBilling) {
        const nextAddress = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' }, // promote the oldest address
        });

        if (nextAddress) {
          const updateData: Prisma.AddressUpdateInput = {};
          if (existing.isDefaultShipping) {
            updateData.isDefaultShipping = true;
          }
          if (existing.isDefaultBilling) {
            updateData.isDefaultBilling = true;
          }
          await tx.address.update({
            where: { id: nextAddress.id },
            data: updateData,
          });
        }
      }

      return existing;
    });
  }

  async setDefault(
    id: string,
    userId: string,
    isShipping: boolean,
    isBilling: boolean
  ): Promise<Address> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: { id, userId },
      });
      if (!existing) {
        throw new NotFoundError('Address not found');
      }

      const updateData: Prisma.AddressUpdateInput = {};

      if (isShipping) {
        await tx.address.updateMany({
          where: { userId, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
        updateData.isDefaultShipping = true;
      }

      if (isBilling) {
        await tx.address.updateMany({
          where: { userId, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
        updateData.isDefaultBilling = true;
      }

      return tx.address.update({
        where: { id },
        data: updateData,
      });
    });
  }
}

export const addressRepository = new AddressRepository();
