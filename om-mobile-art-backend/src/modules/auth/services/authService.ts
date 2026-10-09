import crypto from 'crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env.js';
import { userRepository } from '../repositories/userRepository.js';
import { PasswordResetTokenRepository } from '../repositories/passwordResetTokenRepository.js';
import { EmailVerificationRepository } from '../repositories/emailVerificationRepository.js';
import { PendingRegistrationRepository } from '../repositories/pendingRegistrationRepository.js';
import { 
  AppError,
  AuthenticationError, 
  ConflictError, 
  ForbiddenError,
  NotFoundError 
} from '../../../core/exceptions/exceptions.js';
import { User, Role, OtpPurpose } from '@prisma/client';
import { prisma } from '../../../database/client.js';
import { emailService } from '../../../services/email/emailService.js';
import { smsProvider } from '../../../services/sms/smsProvider.js';
import { otpRepository } from '../repositories/otpRepository.js';

export interface TokenPayload {
  userId: string;
  role: Role;
  sessionId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(
    email: string, 
    password: string, 
    name?: string
  ): Promise<{ pending: boolean; email: string; user?: User; tokens?: AuthTokens }> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    console.log(`[Register] User submitted: ${normalizedEmail}`);

    // 1. Check if email already exists in User database
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      if (existingUser.isEmailVerified) {
        console.error(`[Register] Failed: Email ${normalizedEmail} is already registered & verified.`);
        throw new ConflictError('An account with this email already exists. Please log in.');
      } else {
        // User account exists but email is unverified -> Generate new 6-digit OTP & send verification code
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await EmailVerificationRepository.createOTP(existingUser.id, otpHash, expiresAt);

        await emailService.sendEmailVerification(
          { email: normalizedEmail, name: existingUser.name || name || undefined },
          otp,
          10
        );

        return { pending: true, email: normalizedEmail };
      }
    }

    // 2. Hash password with Argon2
    const passwordHash = await argon2.hash(password);

    // 3. Mandatory Email OTP Verification for New User Registration
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    console.log(`[Register] Verification OTP generated: ${otp}`);

    // 4. Save to PendingRegistration table
    await PendingRegistrationRepository.upsertPendingRegistration(
      normalizedEmail,
      passwordHash,
      otpHash,
      expiresAt,
      name
    );

    // 5. Dispatch Verification OTP Email via EmailService
    const emailResult = await emailService.sendEmailVerification(
      { email: normalizedEmail, name: name || undefined },
      otp,
      10
    );

    if (!emailResult.success) {
      console.error(`[Register] Email dispatch FAILED: ${emailResult.error}`);
      await PendingRegistrationRepository.deleteByEmail(normalizedEmail);
      throw new AppError(
        emailResult.error || 'Failed to send verification email',
        400,
        'EMAIL_DISPATCH_FAILED'
      );
    }

    return { pending: true, email: normalizedEmail };
  }

  private async safeVerifyPassword(hash: string, plainText: string): Promise<boolean> {
    if (!hash || typeof hash !== 'string' || !hash.startsWith('$')) {
      return false;
    }
    try {
      return await argon2.verify(hash, plainText);
    } catch {
      return false;
    }
  }

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AuthenticationError('Invalid email address or password');
    }

    const isPasswordValid = await this.safeVerifyPassword(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email address or password');
    }

    // Check if email is verified. Unverified accounts cannot log in until OTP is verified.
    if (!user.isEmailVerified) {
      throw new AppError('Please verify your email before logging in.', 403, 'EMAIL_NOT_VERIFIED');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    const tokens = this.generateTokens({ 
      userId: user.id, 
      role: user.role, 
      sessionId: session.id 
    });

    await prisma.accountActivity.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        ipAddress,
        userAgent,
        details: 'Successful customer login',
      },
    });

    return { user, tokens };
  }

  async adminLogin(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AuthenticationError('Invalid email address or password');
    }

    if (user.role !== Role.ADMIN && user.role !== Role.EDITOR) {
      throw new ForbiddenError('Access denied: Admin credentials required.');
    }

    // Account Lockout Protection for ADMIN accounts (15 minutes lockout after 5 failed attempts)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const failedAttempts = await prisma.adminActivityLog.count({
      where: {
        userId: user.id,
        action: 'FAILED_LOGIN',
        createdAt: { gte: fifteenMinsAgo },
      },
    });

    if (failedAttempts >= 5) {
      throw new ForbiddenError('Account locked due to 5 consecutive failed login attempts. Please try again after 15 minutes.');
    }

    const isPasswordValid = await this.safeVerifyPassword(user.passwordHash, password);
    if (!isPasswordValid) {
      await prisma.adminActivityLog.create({
        data: {
          userId: user.id,
          action: 'FAILED_LOGIN',
          details: 'Invalid password attempt',
          ipAddress,
          userAgent,
        },
      });

      if (failedAttempts + 1 >= 5) {
        throw new ForbiddenError('Account locked due to 5 consecutive failed login attempts. Please try again after 15 minutes.');
      }
      throw new AuthenticationError('Invalid email address or password');
    }

    // Auto-clear failed login attempts on successful login
    await prisma.adminActivityLog.deleteMany({
      where: {
        userId: user.id,
        action: 'FAILED_LOGIN',
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    const tokens = this.generateTokens({ 
      userId: user.id, 
      role: user.role, 
      sessionId: session.id 
    });

    await prisma.adminActivityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        details: 'Successful administrator login',
        ipAddress,
        userAgent,
      },
    });

    return { user, tokens };
  }

  async logout(
    userId: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (sessionId) {
      await prisma.userSession.updateMany({
        where: { id: sessionId },
        data: { isRevoked: true },
      });
    }

    const user = await userRepository.findById(userId);
    if (user && (user.role === Role.ADMIN || user.role === Role.EDITOR)) {
      await prisma.adminActivityLog.create({
        data: {
          userId: user.id,
          action: 'LOGOUT',
          details: 'Administrator logged out',
          ipAddress,
          userAgent,
        },
      });
    } else if (user) {
      await prisma.accountActivity.create({
        data: {
          userId: user.id,
          action: 'LOGOUT',
          ipAddress,
          userAgent,
          details: 'User logged out',
        },
      });
    }
  }

  async refreshToken(
    token: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      
      if (decoded.sessionId) {
        const session = await prisma.userSession.findUnique({
          where: { id: decoded.sessionId }
        });
        if (!session || session.isRevoked || session.expiresAt < new Date()) {
          throw new AuthenticationError('Session expired or revoked');
        }

        // Revoke old session to enforce Refresh Token Rotation
        await prisma.userSession.update({
          where: { id: session.id },
          data: { isRevoked: true }
        });
      }

      // Create new session for rotated refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const newSession = await prisma.userSession.create({
        data: {
          userId: decoded.userId,
          ipAddress,
          userAgent,
          expiresAt,
        },
      });

      return this.generateTokens({ 
        userId: decoded.userId, 
        role: decoded.role, 
        sessionId: newSession.id 
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Invalid or expired refresh token');
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, oldPassword);
    if (!isPasswordValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(newPassword);
    await userRepository.update(userId, { passwordHash });

    if (user.role === Role.CUSTOMER) {
      await prisma.accountActivity.create({
        data: {
          userId,
          action: 'PASSWORD_CHANGE',
          details: 'Password updated successfully',
        },
      });
    } else {
      await userRepository.logActivity(userId, 'PASSWORD_CHANGE', userId, 'Password updated successfully');
    }

    // Send confirmation email via EmailService
    emailService.sendPasswordResetSuccess({ email: user.email, name: user.name || undefined }).catch((err) => {
      console.error('[AuthService] Failed to dispatch password change email:', err);
    });
  }

  async forgotPassword(email: string, ipAddress?: string, userAgent?: string): Promise<string> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = await userRepository.findByEmail(normalizedEmail);
    const standardMessage = 'If an account exists, a password reset email has been sent.';

    if (!user || user.deletedAt !== null || user.status === 'DELETED' || user.status === 'BLOCKED') {
      // Return standard message to prevent user enumeration attacks
      return standardMessage;
    }

    // 1. Generate 64-character cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    
    // 2. Compute SHA-256 hash for database storage (never store plain tokens)
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 3. Expiration 15 minutes from now
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 4. Save token record in database (automatically invalidates previous active tokens for this user)
    await PasswordResetTokenRepository.createResetToken(
      user.id,
      hashedToken,
      expiresAt,
      ipAddress,
      userAgent
    );

    // 5. Construct reset URL
    const resetUrl = `${env.APP_FRONTEND_URL}/shop/pages/reset_password.html?token=${encodeURIComponent(rawToken)}`;

    // 6. Log account activity
    await prisma.accountActivity.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        ipAddress,
        userAgent,
        details: 'Requested password reset token',
      },
    }).catch(() => {});

    // 7. Dispatch Email asynchronously via EmailService
    emailService.sendForgotPassword({ email: user.email, name: user.name || undefined }, resetUrl, 15).catch((err) => {
      console.error('[AuthService] Failed to dispatch forgot password email:', err);
    });

    return standardMessage;
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (!rawToken || rawToken.trim() === '') {
      throw new AuthenticationError('Invalid or expired password reset token');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new AuthenticationError('Password must be at least 8 characters long');
    }

    // Hash incoming token using SHA-256 to compare against stored hash
    const hashedToken = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    // Find valid (unexpired, unused) token record
    const resetTokenRecord = await PasswordResetTokenRepository.findValidToken(hashedToken);
    if (!resetTokenRecord || !resetTokenRecord.user) {
      throw new AuthenticationError('Invalid or expired password reset token');
    }

    const userId = resetTokenRecord.userId;

    // Hash new password using Argon2
    const passwordHash = await argon2.hash(newPassword);

    // Update user password
    await userRepository.update(userId, { passwordHash });

    // Mark reset token as used (single-use policy)
    await PasswordResetTokenRepository.markAsUsed(resetTokenRecord.id);

    // Revoke all existing sessions for user (security requirement)
    await prisma.userSession.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    // Audit Log
    if (resetTokenRecord.user.role === Role.CUSTOMER) {
      await prisma.accountActivity.create({
        data: {
          userId,
          action: 'PASSWORD_RESET_SUCCESS',
          ipAddress,
          userAgent,
          details: 'Password reset successfully using single-use token',
        },
      }).catch(() => {});
    } else {
      await userRepository.logActivity(userId, 'PASSWORD_RESET_SUCCESS', userId, 'Administrator password reset via token');
    }

    // Dispatch confirmation email
    emailService.sendPasswordResetSuccess({ email: resetTokenRecord.user.email, name: resetTokenRecord.user.name || undefined }).catch((err) => {
      console.error('[AuthService] Failed to dispatch password reset success email:', err);
    });
  }

  async verifyRegistrationOTP(
    email: string,
    otp: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const normalizedEmail = (email || '').trim().toLowerCase();

    // 1. Check if user already exists in User database
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser && existingUser.isEmailVerified) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const session = await prisma.userSession.create({
        data: { userId: existingUser.id, ipAddress, userAgent, expiresAt },
      });
      const tokens = this.generateTokens({ userId: existingUser.id, role: existingUser.role, sessionId: session.id });
      return { user: existingUser, tokens };
    }

    // 2. Retrieve PendingRegistration record
    const pending = await PendingRegistrationRepository.findByEmail(normalizedEmail);
    if (!pending) {
      throw new NotFoundError('No pending registration found for this email address.');
    }

    // 3. Expiration Check (10 mins)
    if (pending.expiresAt < new Date()) {
      throw new AuthenticationError('OTP has expired');
    }

    // 4. Max Attempts Check (5 failed attempts limit)
    if (pending.attempts >= 5) {
      throw new AuthenticationError('Too many failed attempts. Please request a new verification code.');
    }

    // 5. Compare SHA-256 Hash
    const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (inputHash !== pending.otpHash) {
      await PendingRegistrationRepository.incrementAttempts(pending.id);
      throw new AuthenticationError('Invalid OTP');
    }

    // --- OTP IS VALID! NOW CREATE THE ACTUAL USER ACCOUNT IN POSTGRESQL ---
    const user = await userRepository.create({
      email: pending.email,
      passwordHash: pending.passwordHash,
      name: pending.name,
      role: Role.CUSTOMER,
      isEmailVerified: true,
    } as any);

    // Clean up PendingRegistration record
    await PendingRegistrationRepository.deleteByEmail(normalizedEmail);

    // Audit Log
    await prisma.accountActivity.create({
      data: {
        userId: user.id,
        action: 'EMAIL_VERIFICATION_SUCCESS',
        ipAddress,
        userAgent,
        details: 'Email address verified and user account created via 6-digit OTP',
      },
    }).catch(() => {});

    // Dispatch Welcome Email asynchronously
    emailService.sendWelcomeEmail({ email: user.email, name: user.name || undefined }).catch((err) => {
      console.error('[AuthService] Failed to dispatch welcome email:', err);
    });

    // Auto-login session & tokens
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + 7);
    const session = await prisma.userSession.create({
      data: { userId: user.id, ipAddress, userAgent, expiresAt: sessionExpiresAt },
    });

    const tokens = this.generateTokens({ userId: user.id, role: user.role, sessionId: session.id });
    const freshUser = await userRepository.findById(user.id);

    return { user: freshUser!, tokens };
  }

  async resendRegistrationOTP(email: string): Promise<string> {
    const normalizedEmail = (email || '').trim().toLowerCase();

    // Check if user already verified & registered
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      return 'This email is already registered and verified. Please proceed to login.';
    }

    const pending = await PendingRegistrationRepository.findByEmail(normalizedEmail);
    if (!pending) {
      throw new NotFoundError('No pending registration found for this email address.');
    }

    // Cooldown check (60 seconds)
    const timeSinceLastResend = (Date.now() - pending.lastResendAt.getTime()) / 1000;
    if (timeSinceLastResend < 60) {
      const remainingSeconds = Math.ceil(60 - timeSinceLastResend);
      throw new AppError(`Please wait ${remainingSeconds} seconds before requesting a new code.`, 429, 'RATE_LIMIT_EXCEEDED');
    }

    // Resend count check (max 3 resends)
    if (pending.resendCount >= 3) {
      throw new ForbiddenError('Maximum resend attempts reached. Please contact support.');
    }

    const nextResendCount = pending.resendCount + 1;
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const newOtpHash = crypto.createHash('sha256').update(newOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await PendingRegistrationRepository.updateOTPForResend(
      pending.id,
      newOtpHash,
      expiresAt,
      nextResendCount
    );

    emailService.sendEmailVerification({ email: pending.email, name: pending.name || undefined }, newOtp, 10).catch((err) => {
      console.error('[AuthService] Failed to dispatch resend email verification OTP:', err);
    });

    return 'A new verification code has been sent to your email.';
  }

  private generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    const refreshToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    });

    return { accessToken, refreshToken };
  }

  async sendLoginOTP(rawIdentifier: string): Promise<{ channel: 'email' | 'sms'; message: string; target: string }> {
    const identifier = (rawIdentifier || '').trim();
    if (!identifier) {
      throw new AppError('Email address or mobile number is required', 400, 'VALIDATION_ERROR');
    }

    const { user, type } = await userRepository.findByIdentifier(identifier);

    if (type === 'email') {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(identifier)) {
        throw new AppError('Invalid email address format.', 400, 'VALIDATION_ERROR');
      }
      if (!user) {
        throw new NotFoundError('User not found with this email address.');
      }
      if (!user.isEmailVerified) {
        throw new ForbiddenError('Please verify your email before logging in.');
      }

      // Cooldown check (60s)
      const activeOtp = await otpRepository.findActiveOtp({ email: user.email }, OtpPurpose.LOGIN_OTP);
      if (activeOtp) {
        const timeSinceLast = (Date.now() - activeOtp.lastResendAt.getTime()) / 1000;
        if (timeSinceLast < 60) {
          const remaining = Math.ceil(60 - timeSinceLast);
          throw new AppError(`Please wait ${remaining} seconds before requesting a new code.`, 429, 'RATE_LIMIT_EXCEEDED');
        }
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await otpRepository.createOtp({
        userId: user.id,
        email: user.email,
        purpose: OtpPurpose.LOGIN_OTP,
        otpHash,
        expiresAt,
      });

      await emailService.sendEmailVerification(
        { email: user.email, name: user.name || undefined },
        otp,
        10
      );

      return {
        channel: 'email',
        message: 'OTP verification code sent to your email.',
        target: user.email,
      };
    } else {
      const digitsOnly = identifier.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        throw new AppError('Invalid mobile number format.', 400, 'VALIDATION_ERROR');
      }

      if (!user) {
        throw new NotFoundError('User not found with this mobile number.');
      }

      const phone = user.phone || identifier;

      // Cooldown check (60s)
      const activeOtp = await otpRepository.findActiveOtp({ phone }, OtpPurpose.LOGIN_OTP);
      if (activeOtp) {
        const timeSinceLast = (Date.now() - activeOtp.lastResendAt.getTime()) / 1000;
        if (timeSinceLast < 60) {
          const remaining = Math.ceil(60 - timeSinceLast);
          throw new AppError(`Please wait ${remaining} seconds before requesting a new code.`, 429, 'RATE_LIMIT_EXCEEDED');
        }
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await otpRepository.createOtp({
        userId: user.id,
        phone,
        purpose: OtpPurpose.LOGIN_OTP,
        otpHash,
        expiresAt,
      });

      await smsProvider.sendSMS(
        phone,
        `Your OM Mobile Art login verification code is ${otp}. Valid for 10 minutes.`
      );

      return {
        channel: 'sms',
        message: 'OTP verification code sent to your mobile number.',
        target: phone,
      };
    }
  }

  async verifyLoginOTP(
    rawIdentifier: string,
    otp: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const identifier = (rawIdentifier || '').trim();
    const trimmedOtp = (otp || '').trim();

    if (!identifier || !trimmedOtp) {
      throw new AppError('Identifier and OTP are required', 400, 'VALIDATION_ERROR');
    }

    const { user, type } = await userRepository.findByIdentifier(identifier);
    if (!user) {
      throw new NotFoundError('User account not found.');
    }

    if (type === 'email' && !user.isEmailVerified) {
      throw new ForbiddenError('Please verify your email before logging in.');
    }

    const identifierQuery = type === 'email' ? { email: user.email } : { phone: user.phone || identifier };
    const activeOtp = await otpRepository.findActiveOtp(identifierQuery, OtpPurpose.LOGIN_OTP);

    if (!activeOtp) {
      throw new AuthenticationError('Invalid or expired OTP. Please request a new code.');
    }

    if (activeOtp.expiresAt.getTime() < Date.now()) {
      await otpRepository.deleteOtp(activeOtp.id);
      throw new AuthenticationError('OTP has expired. Please request a new code.');
    }

    if (activeOtp.attempts >= 5) {
      throw new AuthenticationError('Too many failed attempts. Please request a new OTP.');
    }

    const inputHash = crypto.createHash('sha256').update(trimmedOtp).digest('hex');
    if (inputHash !== activeOtp.otpHash) {
      await otpRepository.incrementAttempts(activeOtp.id);
      throw new AuthenticationError('Invalid OTP code. Please try again.');
    }

    await otpRepository.deleteOtp(activeOtp.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + 7);
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        ipAddress,
        userAgent,
        expiresAt: sessionExpiresAt,
      },
    });

    const tokens = this.generateTokens({
      userId: user.id,
      role: user.role,
      sessionId: session.id,
    });

    await prisma.accountActivity.create({
      data: {
        userId: user.id,
        action: 'LOGIN_OTP',
        ipAddress,
        userAgent,
        details: `Successful OTP login via ${type.toUpperCase()}`,
      },
    }).catch(() => {});

    const freshUser = await userRepository.findById(user.id);
    return { user: freshUser!, tokens };
  }
}

export const authService = new AuthService();
