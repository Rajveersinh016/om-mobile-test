import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { profileService } from '../services/profileService.js';
import { ValidationError, AuthenticationError } from '../../../core/exceptions/exceptions.js';
import {
  updateProfileSchema,
  uploadAvatarSchema,
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

export class ProfileController {
  async getProfile(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const profile = await profileService.getProfile(user.id);
    return reply.status(200).send({
      success: true,
      data: profile,
    });
  }

  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const body = validateBody(updateProfileSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const profile = await profileService.updateProfile(user.id, body, ip, ua);
    return reply.status(200).send({
      success: true,
      data: profile,
    });
  }

  async uploadAvatar(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const body = validateBody(uploadAvatarSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const result = await profileService.uploadAvatar(user.id, body.filename, body.content, ip, ua);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async deleteAvatar(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    await profileService.deleteAvatar(user.id, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Avatar deleted successfully',
    });
  }

  async listSessions(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const currentSessionId = request.sessionId;
    const sessions = await profileService.listSessions(user.id, currentSessionId);
    return reply.status(200).send({
      success: true,
      data: sessions,
    });
  }

  async revokeSession(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const { id } = request.params as { id: string };
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    await profileService.revokeSession(user.id, id, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Session revoked successfully',
    });
  }

  async revokeAllSessions(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const currentSessionId = request.sessionId;
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    await profileService.revokeAllSessions(user.id, currentSessionId, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'All other sessions revoked successfully',
    });
  }

  async deactivateAccount(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    await profileService.deactivateAccount(user.id, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Account deactivated successfully',
    });
  }

  async restoreAccount(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    await profileService.restoreAccount(id, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Account restored successfully',
    });
  }

  async listActivities(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const activities = await profileService.listActivities(user.id);
    return reply.status(200).send({
      success: true,
      data: activities,
    });
  }
}

export const profileController = new ProfileController();
