import { z } from 'zod';

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const strictEmailSchema = z
  .string()
  .min(1, { message: 'Email address is required' })
  .regex(emailRegex, { message: 'Invalid email address format. Must be a valid address like user@example.com' });

export const registerSchema = z.object({
  name: z.string().optional(),
  email: strictEmailSchema,
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
});

export const loginSchema = z.object({
  email: strictEmailSchema,
  password: z.string().min(1, { message: 'Password is required' }),
});

export const forgotPasswordSchema = z.object({
  email: strictEmailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, { message: 'Reset token is required' }),
    password: z.string().min(8, { message: 'New password must be at least 8 characters long' }).optional(),
    newPassword: z.string().min(8, { message: 'New password must be at least 8 characters long' }).optional(),
    confirmPassword: z.string().optional(),
  })
  .refine((data) => data.password || data.newPassword, {
    message: 'New password is required',
    path: ['password'],
  })
  .refine(
    (data) => {
      const pass = data.password || data.newPassword;
      if (!data.confirmPassword) return true;
      return pass === data.confirmPassword;
    },
    {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }
  );

export const verifyRegistrationOTPSchema = z.object({
  email: strictEmailSchema,
  otp: z.string().length(6, { message: 'Verification code must be exactly 6 digits' }),
});

export const resendRegistrationOTPSchema = z.object({
  email: strictEmailSchema,
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, { message: 'Old password is required' }),
  newPassword: z.string().min(8, { message: 'New password must be at least 8 characters long' }),
});

export const updateProfileSchema = z.object({
  email: strictEmailSchema.optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, { message: 'Refresh token is required' }),
});

export const sendLoginOTPSchema = z.object({
  identifier: z.string().min(1, { message: 'Email address or Mobile number is required' }),
});

export const verifyLoginOTPSchema = z.object({
  identifier: z.string().min(1, { message: 'Email address or Mobile number is required' }),
  otp: z.string().length(6, { message: 'OTP must be exactly 6 digits' }),
});

