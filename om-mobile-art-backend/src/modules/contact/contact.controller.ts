import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { emailService } from '../../services/email/emailService.js';
import { ValidationError } from '../../core/exceptions/exceptions.js';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
});

export class ContactController {
  static async submitContactForm(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = contactSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid contact submission data', parseResult.error.format());
    }

    const { name, email, phone, subject, message } = parseResult.data;

    // 1. Send Auto-Reply to Customer via EmailService
    emailService.sendContactFormAutoReply({
      recipient: { email, name },
      subject,
      message,
    }).catch(err => {
      console.error('[ContactController] Failed to send contact auto-reply email:', err);
    });

    // 2. Send Admin Notification via EmailService
    emailService.sendContactFormAdminNotification({
      adminEmail: process.env.ADMIN_EMAIL || 'admin@ommobileart.com',
      senderName: name,
      senderEmail: email,
      phone,
      subject,
      message,
    }).catch(err => {
      console.error('[ContactController] Failed to send contact admin notification email:', err);
    });

    return reply.status(200).send({
      success: true,
      message: 'Thank you for reaching out! Your message has been received and our support team will respond shortly.',
    });
  }
}
