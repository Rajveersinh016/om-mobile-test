import { describe, it, expect, beforeEach } from 'vitest';
import { emailService } from './emailService.js';
import { emailTemplateService } from './templates/emailTemplateService.js';
import { EmailTemplateType } from './templates/templateTypes.js';

describe('Centralized Email Service & Templates Suite', () => {

  describe('1. Template Rendering (All 14 Required Templates)', () => {
    
    it('should render 1. WELCOME email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.WELCOME, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
      });

      expect(rendered.subject).toContain('Welcome to OM Mobile Art');
      expect(rendered.html).toContain('John Doe');
      expect(rendered.html).toContain('MOBILE ART');
      expect(rendered.text).toContain('John Doe');
    });

    it('should render 2. EMAIL_VERIFICATION email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.EMAIL_VERIFICATION, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
        verificationUrl: 'http://localhost:8080/verify?token=123456',
        expiresInMinutes: 30,
      });

      expect(rendered.subject).toContain('Verify Your OM Mobile Art Account');
      expect(rendered.html).toContain('http://localhost:8080/verify?token=123456');
      expect(rendered.html).toContain('30 minutes');
      expect(rendered.text).toContain('30 minutes');
    });

    it('should render 3. FORGOT_PASSWORD email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.FORGOT_PASSWORD, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
        resetUrl: 'http://localhost:8080/reset?token=abc',
        expiresInMinutes: 15,
      });

      expect(rendered.subject).toContain('Password Reset Request');
      expect(rendered.html).toContain('http://localhost:8080/reset?token=abc');
      expect(rendered.html).toContain('15 minutes');
      expect(rendered.text).toContain('15 minutes');
    });

    it('should render 4. PASSWORD_RESET_SUCCESS email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.PASSWORD_RESET_SUCCESS, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
      });

      expect(rendered.subject).toContain('Password Has Been Reset Successfully');
      expect(rendered.html).toContain('updated successfully');
      expect(rendered.text).toContain('updated successfully');
    });

    it('should render 5. ORDER_CONFIRMATION email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.ORDER_CONFIRMATION, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
        orderNumber: 'OM-2608-0001',
        subtotal: 798,
        discount: 100,
        shippingFee: 0,
        total: 698,
        items: [
          { name: 'Cyberpunk Skin', quantity: 2, price: 399, finish: 'Matte', material: '3M' }
        ],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Test St',
          city: 'Surat',
          zip: '395006',
        },
      });

      expect(rendered.subject).toContain('Order Confirmation #OM-2608-0001');
      expect(rendered.html).toContain('Cyberpunk Skin');
      expect(rendered.html).toContain('698.00');
      expect(rendered.text).toContain('OM-2608-0001');
    });

    it('should render 6. PAYMENT_SUCCESSFUL email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.PAYMENT_SUCCESSFUL, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
        orderNumber: 'OM-2608-0001',
        transactionId: 'TXN-998877',
        amount: 698,
        paymentMethod: 'UPI',
      });

      expect(rendered.subject).toContain('Payment Successful');
      expect(rendered.html).toContain('TXN-998877');
      expect(rendered.html).toContain('UPI');
      expect(rendered.text).toContain('TXN-998877');
    });

    it('should render 7. ORDER_SHIPPED email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.ORDER_SHIPPED, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
        orderNumber: 'OM-2608-0001',
        carrier: 'BlueDart Express',
        trackingNumber: 'BD123456789IN',
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Test St',
          city: 'Surat',
          zip: '395006',
        },
      });

      expect(rendered.subject).toContain('Your Order #OM-2608-0001 Has Shipped');
      expect(rendered.html).toContain('BlueDart Express');
      expect(rendered.html).toContain('BD123456789IN');
      expect(rendered.text).toContain('BD123456789IN');
    });

    it('should render 8. OUT_FOR_DELIVERY email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.OUT_FOR_DELIVERY, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
        orderNumber: 'OM-2608-0001',
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Test St',
          city: 'Surat',
          zip: '395006',
        },
      });

      expect(rendered.subject).toContain('Out For Delivery Today');
      expect(rendered.html).toContain('OM-2608-0001');
      expect(rendered.text).toContain('out for delivery today');
    });

    it('should render 9. DELIVERED email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.DELIVERED, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
        orderNumber: 'OM-2608-0001',
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Test St',
          city: 'Surat',
          zip: '395006',
        },
      });

      expect(rendered.subject).toContain('Order #OM-2608-0001 Delivered');
      expect(rendered.html).toContain('flawless fit');
      expect(rendered.text).toContain('delivered');
    });

    it('should render 10. CANCELLED email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.CANCELLED, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
        orderNumber: 'OM-2608-0001',
        reason: 'Customer requested cancellation',
        refundAmount: 698,
      });

      expect(rendered.subject).toContain('Order #OM-2608-0001 Cancellation Notice');
      expect(rendered.html).toContain('Customer requested cancellation');
      expect(rendered.text).toContain('cancelled');
    });

    it('should render 11. REFUND_INITIATED email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.REFUND_INITIATED, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
        orderNumber: 'OM-2608-0001',
        refundReference: 'REF-887766',
        amount: 698,
      });

      expect(rendered.subject).toContain('Refund Initiated');
      expect(rendered.html).toContain('REF-887766');
      expect(rendered.text).toContain('REF-887766');
    });

    it('should render 12. REFUND_COMPLETED email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.REFUND_COMPLETED, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
        orderNumber: 'OM-2608-0001',
        refundReference: 'REF-887766',
        amount: 698,
      });

      expect(rendered.subject).toContain('Refund Completed');
      expect(rendered.html).toContain('REF-887766');
      expect(rendered.text).toContain('complete');
    });

    it('should render 13. CONTACT_AUTO_REPLY email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.CONTACT_AUTO_REPLY, {
        recipient: { email: 'john@example.com', name: 'John Doe' },
        subject: 'Custom Skin Inquiry',
        message: 'Hi, do you offer gold foil finishes for iPhone 16 Pro?',
      });

      expect(rendered.subject).toContain('Thank you for contacting OM Mobile Art');
      expect(rendered.html).toContain('Custom Skin Inquiry');
      expect(rendered.text).toContain('Custom Skin Inquiry');
    });

    it('should render 14. CONTACT_ADMIN_NOTIFICATION email with HTML & text', () => {
      const rendered = emailTemplateService.render(EmailTemplateType.CONTACT_ADMIN_NOTIFICATION, {
        adminEmail: 'admin@ommobileart.com',
        senderName: 'John Doe',
        senderEmail: 'john@example.com',
        subject: 'Custom Skin Inquiry',
        message: 'Hi, do you offer gold foil finishes for iPhone 16 Pro?',
      });

      expect(rendered.subject).toContain('[ADMIN ALERT]');
      expect(rendered.html).toContain('John Doe');
      expect(rendered.html).toContain('john@example.com');
      expect(rendered.text).toContain('NEW CONTACT FORM SUBMISSION');
    });

  });

  describe('2. EmailService Queue & Dispatch Integration', () => {

    it('should dispatch welcome email via EmailService successfully', async () => {
      const res = await emailService.sendWelcomeEmail({ email: 'ommobileart09@gmail.com', name: 'Tester' });
      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });

    it('should dispatch forgot password email via EmailService successfully', async () => {
      const res = await emailService.sendForgotPassword({ email: 'ommobileart09@gmail.com', name: 'Tester' }, 'http://localhost:8080/reset?token=xyz');
      expect(res.success).toBe(true);
    });

    it('should dispatch order confirmation email via EmailService successfully', async () => {
      const res = await emailService.sendOrderConfirmation({
        recipient: { email: 'ommobileart09@gmail.com', name: 'Tester' },
        orderNumber: 'OM-1001',
        subtotal: 500,
        total: 500,
        items: [{ name: 'Test Skin', quantity: 1, price: 500 }],
        shippingAddress: { firstName: 'Tester', lastName: 'User', street: 'Street 1', city: 'City', zip: '10001' },
      });
      expect(res.success).toBe(true);
    });

  });

});
