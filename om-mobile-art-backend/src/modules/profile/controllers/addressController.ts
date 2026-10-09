import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { addressService } from '../services/addressService.js';
import { ValidationError, AuthenticationError } from '../../../core/exceptions/exceptions.js';
import {
  createAddressSchema,
  updateAddressSchema,
} from '../validators/profileValidator.js';

function validateBody<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      issue: err.message,
    }));
    throw new ValidationError('Validation failed', details);
  }
  return result.data;
}

export class AddressController {
  async listAddresses(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const addresses = await addressService.listAddresses(user.id);
    return reply.status(200).send({
      success: true,
      data: addresses,
    });
  }

  async getAddress(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const { id } = request.params as { id: string };
    const address = await addressService.getAddress(id, user.id);
    return reply.status(200).send({
      success: true,
      data: address,
    });
  }

  async createAddress(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const body = validateBody(createAddressSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const address = await addressService.createAddress(user.id, body, ip, ua);
    return reply.status(201).send({
      success: true,
      data: address,
    });
  }

  async updateAddress(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const { id } = request.params as { id: string };
    const body = validateBody(updateAddressSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const address = await addressService.updateAddress(id, user.id, body, ip, ua);
    return reply.status(200).send({
      success: true,
      data: address,
    });
  }

  async deleteAddress(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const { id } = request.params as { id: string };
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    await addressService.deleteAddress(id, user.id, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Address deleted successfully',
    });
  }

  async setDefaultAddress(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const { id } = request.params as { id: string };
    const body = validateBody(
      createAddressSchema.pick({ isDefaultShipping: true, isDefaultBilling: true }).partial(),
      request.body
    );
    
    if (body.isDefaultShipping === undefined && body.isDefaultBilling === undefined) {
      throw new ValidationError('Must specify isDefaultShipping or isDefaultBilling');
    }

    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const address = await addressService.setDefaultAddress(
      id,
      user.id,
      !!body.isDefaultShipping,
      !!body.isDefaultBilling,
      ip,
      ua
    );
    return reply.status(200).send({
      success: true,
      data: address,
    });
  }
}

export const addressController = new AddressController();
