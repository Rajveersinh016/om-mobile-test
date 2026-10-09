import { addressRepository } from '../repositories/addressRepository.js';
import { Address } from '@prisma/client';
import { prisma } from '../../../database/client.js';
import { NotFoundError } from '../../../core/exceptions/exceptions.js';

export class AddressService {
  async logActivity(
    userId: string,
    action: string,
    ipAddress?: string,
    userAgent?: string,
    details?: string
  ): Promise<void> {
    await prisma.accountActivity.create({
      data: {
        userId,
        action,
        ipAddress,
        userAgent,
        details,
      },
    });
  }

  async createAddress(
    userId: string,
    data: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Address> {
    const address = await addressRepository.create(userId, data);
    await this.logActivity(
      userId,
      'ADDRESS_CREATE',
      ipAddress,
      userAgent,
      `Created address ${address.id} (${address.type})`
    );
    return address;
  }

  async updateAddress(
    id: string,
    userId: string,
    data: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Address> {
    const address = await addressRepository.update(id, userId, data);
    await this.logActivity(
      userId,
      'ADDRESS_UPDATE',
      ipAddress,
      userAgent,
      `Updated address ${id}`
    );
    return address;
  }

  async deleteAddress(
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Address> {
    const address = await addressRepository.delete(id, userId);
    await this.logActivity(
      userId,
      'ADDRESS_DELETE',
      ipAddress,
      userAgent,
      `Deleted address ${id}`
    );
    return address;
  }

  async getAddress(id: string, userId: string): Promise<Address> {
    const address = await addressRepository.findById(id, userId);
    if (!address) {
      throw new NotFoundError('Address not found');
    }
    return address;
  }

  async listAddresses(userId: string): Promise<Address[]> {
    return addressRepository.findAllByUserId(userId);
  }

  async setDefaultAddress(
    id: string,
    userId: string,
    isShipping: boolean,
    isBilling: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Address> {
    const address = await addressRepository.setDefault(id, userId, isShipping, isBilling);
    await this.logActivity(
      userId,
      'ADDRESS_SET_DEFAULT',
      ipAddress,
      userAgent,
      `Set address ${id} as default (shipping=${isShipping}, billing=${isBilling})`
    );
    return address;
  }
}

export const addressService = new AddressService();
