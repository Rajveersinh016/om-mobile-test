import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, { message: 'DATABASE_URL is required' }),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, { message: 'JWT_SECRET must be at least 32 characters' }),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*'),

  // Cloudinary Environment Variables
  CLOUDINARY_CLOUD_NAME: z.string().min(1, { message: 'CLOUDINARY_CLOUD_NAME is required' }),
  CLOUDINARY_API_KEY: z.string().min(1, { message: 'CLOUDINARY_API_KEY is required' }),
  CLOUDINARY_API_SECRET: z.string().min(1, { message: 'CLOUDINARY_API_SECRET is required' }),
  CLOUDINARY_FOLDER: z.string().default('om-mobile-art'),

  // Admin Credentials
  ADMIN_EMAIL: z.string().min(1, { message: 'ADMIN_EMAIL is required in environment' }),
  ADMIN_PASSWORD: z.string().min(1, { message: 'ADMIN_PASSWORD is required in environment' }),

  // Email Service Configuration
  EMAIL_PROVIDER: z.enum(['auto', 'resend', 'smtp', 'console']).default('auto'),
  EMAIL_FROM: z.string().default('OM Mobile Art <noreply@ommobileart.com>'),
  EMAIL_REPLY_TO: z.string().default('support@ommobileart.com'),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  APP_FRONTEND_URL: z.string().default('http://localhost:8080'),

  // Auth Verification Feature Flag (Development Bypass vs Production Requirement)
  AUTH_REQUIRE_EMAIL_VERIFICATION: z
    .preprocess((val) => String(val).toLowerCase() === 'true', z.boolean())
    .default(false),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ CRITICAL ERROR: Invalid or missing environment variables:');
  const formattedErrors = result.error.format();
  Object.keys(formattedErrors).forEach(key => {
    if (key !== '_errors') {
      const fieldError = (formattedErrors as any)[key]?._errors;
      if (fieldError && fieldError.length > 0) {
        console.error(`   - ${key}: ${fieldError.join(', ')}`);
      }
    }
  });
  process.exit(1);
}

export const env = result.data;
export type Env = z.infer<typeof envSchema>;
