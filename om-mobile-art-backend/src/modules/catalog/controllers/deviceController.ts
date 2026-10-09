import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { deviceService } from '../services/deviceService.js';
import { ValidationError } from '../../../core/exceptions/exceptions.js';
import { createDeviceSchema, updateDeviceSchema } from '../validators/catalogValidator.js';

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

export class DeviceController {
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const devices = await deviceService.getAllDevices();
    return reply.status(200).send({
      success: true,
      data: devices,
    });
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const device = await deviceService.getDeviceById(id);
    return reply.status(200).send({
      success: true,
      data: device,
    });
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createDeviceSchema, request.body);
    const device = await deviceService.createDevice(body.name, body.brand, body.slug);
    return reply.status(201).send({
      success: true,
      data: device,
    });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateDeviceSchema, request.body);
    const device = await deviceService.updateDevice(id, body.name, body.brand, body.slug);
    return reply.status(200).send({
      success: true,
      data: device,
    });
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const device = await deviceService.deleteDevice(id);
    return reply.status(200).send({
      success: true,
      message: `Device '${device.name}' deleted successfully`,
    });
  }
}

export const deviceController = new DeviceController();
