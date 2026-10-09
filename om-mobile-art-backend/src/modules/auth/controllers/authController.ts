import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { authService } from '../services/authService.js';
import { userRepository } from '../repositories/userRepository.js';
import { ValidationError, AuthenticationError } from '../../../core/exceptions/exceptions.js';
import { User } from '@prisma/client';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyRegistrationOTPSchema,
  resendRegistrationOTPSchema,
  changePasswordSchema,
  updateProfileSchema,
  sendLoginOTPSchema,
  verifyLoginOTPSchema,
} from '../validators/authValidator.js';

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

function sanitizeUser(user: User) {
  const { passwordHash, ...sanitized } = user;
  return sanitized;
}

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(registerSchema, request.body);
    const result = await authService.register(body.email, body.password, body.name);

    // Development bypass
    if (!result.pending && result.user && result.tokens) {
      return reply.status(201).send({
        success: true,
        message: 'Account created and logged in successfully.',
        pending: false,
        data: {
          user: sanitizeUser(result.user),
          tokens: result.tokens,
          email: result.email,
        },
      });
    }

    // Production requires email verification
    return reply.status(201).send({
      success: true,
      message: 'Verification code sent to your email.',
      pending: result.pending,
      data: {
        email: result.email,
      },
    });
  }

  async verifyEmail(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(verifyRegistrationOTPSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';
    const { user, tokens } = await authService.verifyRegistrationOTP(body.email, body.otp, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Email verified successfully. Account created!',
      data: {
        user: sanitizeUser(user),
        tokens,
      },
    });
  }

  async resendVerification(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(resendRegistrationOTPSchema, request.body);
    const message = await authService.resendRegistrationOTP(body.email);
    return reply.status(200).send({
      success: true,
      message,
    });
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(loginSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';
    const { user, tokens } = await authService.login(body.email, body.password, ip, ua);
    return reply.status(200).send({
      success: true,
      data: {
        user: sanitizeUser(user),
        tokens,
      },
    });
  }

  async adminLogin(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(loginSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';
    const { user, tokens } = await authService.adminLogin(body.email, body.password, ip, ua);
    return reply.status(200).send({
      success: true,
      data: {
        user: sanitizeUser(user),
        tokens,
      },
    });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';
    await authService.logout(user.id, user.sessionId, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(refreshTokenSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';
    const tokens = await authService.refreshToken(body.refreshToken, ip, ua);
    return reply.status(200).send({
      success: true,
      data: tokens,
    });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    return reply.status(200).send({
      success: true,
      data: sanitizeUser(user),
    });
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(forgotPasswordSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';
    const message = await authService.forgotPassword(body.email, ip, ua);
    return reply.status(200).send({
      success: true,
      message,
    });
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(resetPasswordSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';
    const pass = body.password || body.newPassword || '';
    await authService.resetPassword(body.token, pass, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Password reset successfully',
    });
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const body = validateBody(changePasswordSchema, request.body);
    await authService.changePassword(user.id, body.oldPassword, body.newPassword);
    return reply.status(200).send({
      success: true,
      message: 'Password updated successfully',
    });
  }

  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const body = validateBody(updateProfileSchema, request.body);
    
    // If there is nothing to update, return the current user
    if (!body.email) {
      return reply.status(200).send({
        success: true,
        data: sanitizeUser(user),
      });
    }

    const updatedUser = await userRepository.update(user.id, { email: body.email });
    return reply.status(200).send({
      success: true,
      data: sanitizeUser(updatedUser),
    });
  }

  async sendLoginOTP(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(sendLoginOTPSchema, request.body);
    const result = await authService.sendLoginOTP(body.identifier);
    return reply.status(200).send({
      success: true,
      message: result.message,
      data: {
        channel: result.channel,
        target: result.target,
      },
    });
  }

  async verifyLoginOTP(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(verifyLoginOTPSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';
    const { user, tokens } = await authService.verifyLoginOTP(body.identifier, body.otp, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Login successful',
      data: {
        user: sanitizeUser(user),
        tokens,
      },
    });
  }
}

export const authController = new AuthController();

