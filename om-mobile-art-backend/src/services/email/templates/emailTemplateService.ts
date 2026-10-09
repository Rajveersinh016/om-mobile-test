import { 
  EmailTemplateType, 
  TemplateContextMap, 
  RenderedEmail,
  WelcomeContext,
  EmailVerificationContext,
  ForgotPasswordContext,
  PasswordResetSuccessContext,
  OrderConfirmationContext,
  PaymentSuccessfulContext,
  OrderShippedContext,
  OutForDeliveryContext,
  DeliveredContext,
  CancelledContext,
  RefundInitiatedContext,
  RefundCompletedContext,
  ContactFormAutoReplyContext,
  ContactFormAdminNotificationContext,
} from './templateTypes.js';
import { renderMasterLayout } from './layout.js';
import { getEmailConfig } from '../config/emailConfig.js';

export class EmailTemplateService {
  render<T extends EmailTemplateType>(type: T, context: TemplateContextMap[T]): RenderedEmail {
    const config = getEmailConfig();
    const appFrontendUrl = config.appFrontendUrl;

    switch (type) {
      case EmailTemplateType.WELCOME:
        return this.renderWelcome(context as WelcomeContext, appFrontendUrl);

      case EmailTemplateType.EMAIL_VERIFICATION:
        return this.renderEmailVerification(context as EmailVerificationContext, appFrontendUrl);

      case EmailTemplateType.FORGOT_PASSWORD:
        return this.renderForgotPassword(context as ForgotPasswordContext, appFrontendUrl);

      case EmailTemplateType.PASSWORD_RESET_SUCCESS:
        return this.renderPasswordResetSuccess(context as PasswordResetSuccessContext, appFrontendUrl);

      case EmailTemplateType.ORDER_CONFIRMATION:
        return this.renderOrderConfirmation(context as OrderConfirmationContext, appFrontendUrl);

      case EmailTemplateType.PAYMENT_SUCCESSFUL:
        return this.renderPaymentSuccessful(context as PaymentSuccessfulContext, appFrontendUrl);

      case EmailTemplateType.ORDER_SHIPPED:
        return this.renderOrderShipped(context as OrderShippedContext, appFrontendUrl);

      case EmailTemplateType.OUT_FOR_DELIVERY:
        return this.renderOutForDelivery(context as OutForDeliveryContext, appFrontendUrl);

      case EmailTemplateType.DELIVERED:
        return this.renderDelivered(context as DeliveredContext, appFrontendUrl);

      case EmailTemplateType.CANCELLED:
        return this.renderCancelled(context as CancelledContext, appFrontendUrl);

      case EmailTemplateType.REFUND_INITIATED:
        return this.renderRefundInitiated(context as RefundInitiatedContext, appFrontendUrl);

      case EmailTemplateType.REFUND_COMPLETED:
        return this.renderRefundCompleted(context as RefundCompletedContext, appFrontendUrl);

      case EmailTemplateType.CONTACT_AUTO_REPLY:
        return this.renderContactFormAutoReply(context as ContactFormAutoReplyContext, appFrontendUrl);

      case EmailTemplateType.CONTACT_ADMIN_NOTIFICATION:
        return this.renderContactFormAdminNotification(context as ContactFormAdminNotificationContext, appFrontendUrl);

      default:
        throw new Error(`Unsupported email template type: ${type}`);
    }
  }

  // 1. Welcome Email
  private renderWelcome(ctx: WelcomeContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Valued Customer';
    const shopUrl = ctx.shopUrl || `${appFrontendUrl}/shop/pages/shop.html`;

    const htmlBody = `
      <h2 style="color: #03045E; font-size: 22px; margin-top: 0; font-weight: 700;">Welcome to OM Mobile Art, ${name}! 🎉</h2>
      <p>We are thrilled to have you join our community of mobile aesthetics enthusiasts.</p>
      <p>At OM Mobile Art, we craft ultra-precise 3M mobile skins, screen laminations, and custom wraps designed to elevate your personal tech devices.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${shopUrl}" class="btn-primary" target="_blank">Explore Storefront</a>
      </div>
      <p style="color: #64748B; font-size: 14px;">If you ever have any questions or need custom designs, feel free to reply directly to this email or reach our support team.</p>
    `;

    return {
      subject: 'Welcome to OM Mobile Art! ✨',
      html: renderMasterLayout({
        title: 'Welcome to OM Mobile Art',
        preheader: 'Discover precision-crafted mobile skins and textures.',
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Welcome to OM Mobile Art, ${name}!\n\nWe are thrilled to have you join our community. Explore our latest skin drops at: ${shopUrl}\n\nThank you for choosing OM Mobile Art.`,
    };
  }

  // 2. Email Verification
  private renderEmailVerification(ctx: EmailVerificationContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Customer';
    const mins = ctx.expiresInMinutes || 30;

    const htmlBody = `
      <h2 style="color: #03045E; font-size: 22px; margin-top: 0; font-weight: 700;">Verify Your Email Address</h2>
      <p>Hello ${name},</p>
      <p>Thank you for registering with OM Mobile Art. Please click the button below to verify your email address and activate your account.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${ctx.verificationUrl}" class="btn-primary" target="_blank">Verify Email Address</a>
      </div>
      <p style="font-size: 13px; color: #64748B;">This verification link will expire in <strong>${mins} minutes</strong>. If you did not create an account, please ignore this email.</p>
      <p style="font-size: 12px; color: #94A3B8; word-break: break-all;">Link URL: <a href="${ctx.verificationUrl}" style="color: #0077B6;">${ctx.verificationUrl}</a></p>
    `;

    return {
      subject: 'Verify Your OM Mobile Art Account ✉️',
      html: renderMasterLayout({
        title: 'Verify Your Email Address',
        preheader: 'Confirm your email address to get started with OM Mobile Art.',
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Hello ${name},\n\nPlease verify your email address by opening the following link:\n${ctx.verificationUrl}\n\nThis link expires in ${mins} minutes.`,
    };
  }

  // 3. Forgot Password
  private renderForgotPassword(ctx: ForgotPasswordContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Customer';
    const mins = ctx.expiresInMinutes || 15;

    const htmlBody = `
      <h2 style="color: #03045E; font-size: 22px; margin-top: 0; font-weight: 700;">Password Reset Request</h2>
      <p>Hello ${name},</p>
      <p>We received a request to reset your password for your OM Mobile Art account. Click the button below to proceed with resetting your password:</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${ctx.resetUrl}" class="btn-primary" target="_blank">Reset Password</a>
      </div>
      <p style="font-size: 13px; color: #64748B;">This password reset link is valid for <strong>${mins} minutes</strong>.</p>
      <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 12px 16px; margin-top: 24px; border-radius: 4px;">
        <p style="margin: 0; color: #991B1B; font-size: 13px; font-weight: 600;">Security Warning:</p>
        <p style="margin: 4px 0 0 0; color: #B91C1C; font-size: 12px;">If you did not request a password reset, please ignore this email or contact support immediately to keep your account safe.</p>
      </div>
    `;

    return {
      subject: 'Password Reset Request — OM Mobile Art 🔑',
      html: renderMasterLayout({
        title: 'Password Reset Request',
        preheader: 'Reset link for your OM Mobile Art account password.',
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Hello ${name},\n\nReset your password using the link below:\n${ctx.resetUrl}\n\nThis link expires in ${mins} minutes. If you did not request this, please ignore this email.`,
    };
  }

  // 4. Password Reset Success
  private renderPasswordResetSuccess(ctx: PasswordResetSuccessContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Customer';
    const loginUrl = ctx.loginUrl || `${appFrontendUrl}/shop/pages/login.html`;

    const htmlBody = `
      <h2 style="color: #03045E; font-size: 22px; margin-top: 0; font-weight: 700;">Password Reset Successfully ✅</h2>
      <p>Hello ${name},</p>
      <p>Your password for OM Mobile Art has been updated successfully.</p>
      <p>You can now log in using your new password:</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}" class="btn-primary" target="_blank">Log In Now</a>
      </div>
      <p style="font-size: 13px; color: #64748B;">If you did not perform this password reset, please notify our security team immediately at <a href="mailto:support@ommobileart.com" style="color: #0077B6;">support@ommobileart.com</a>.</p>
    `;

    return {
      subject: 'Your Password Has Been Reset Successfully ✅',
      html: renderMasterLayout({
        title: 'Password Reset Success',
        preheader: 'Confirmation that your password has been updated.',
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Hello ${name},\n\nYour password for OM Mobile Art has been updated successfully. You can now log in at:\n${loginUrl}`,
    };
  }

  // 5. Order Confirmation
  private renderOrderConfirmation(ctx: OrderConfirmationContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Customer';
    const trackUrl = ctx.trackOrderUrl || `${appFrontendUrl}/shop/pages/profile.html#orders`;

    const itemsRows = ctx.items.map(item => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #E2E8F0;">
          <strong style="color: #1E293B;">${item.name}</strong><br/>
          <span style="font-size: 12px; color: #64748B;">
            ${item.device ? `Device: ${item.device} | ` : ''}
            ${item.finish ? `Finish: ${item.finish} | ` : ''}
            ${item.material ? `Material: ${item.material}` : ''}
          </span>
        </td>
        <td align="center" style="padding: 12px 0; border-bottom: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">x${item.quantity}</td>
        <td align="right" style="padding: 12px 0; border-bottom: 1px solid #E2E8F0; color: #03045E; font-weight: 700;">₹${item.price.toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlBody = `
      <h2 style="color: #03045E; font-size: 22px; margin-top: 0; font-weight: 700;">Order Confirmed! 📦 Order #${ctx.orderNumber}</h2>
      <p>Thank you for your purchase, ${name}! We have received your order and are currently preparing it for precision crafting.</p>
      
      <div style="background-color: #F8FAFC; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #E2E8F0;">
        <h3 style="margin-top: 0; color: #03045E; font-size: 16px; border-bottom: 2px solid #0077B6; padding-bottom: 8px;">Order Summary</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          <thead>
            <tr style="font-size: 12px; text-transform: uppercase; color: #64748B; border-bottom: 1px solid #CBD5E1;">
              <th align="left" style="padding-bottom: 8px;">Item</th>
              <th align="center" style="padding-bottom: 8px;">Qty</th>
              <th align="right" style="padding-bottom: 8px;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
          <tr>
            <td style="color: #64748B; font-size: 13px;">Subtotal:</td>
            <td align="right" style="color: #1E293B; font-weight: 600;">₹${ctx.subtotal.toFixed(2)}</td>
          </tr>
          ${ctx.discount ? `
          <tr>
            <td style="color: #16A34A; font-size: 13px;">Discount:</td>
            <td align="right" style="color: #16A34A; font-weight: 600;">-₹${ctx.discount.toFixed(2)}</td>
          </tr>` : ''}
          <tr>
            <td style="color: #64748B; font-size: 13px;">Shipping:</td>
            <td align="right" style="color: #1E293B; font-weight: 600;">${(ctx.shippingFee || 0) === 0 ? 'FREE' : `₹${ctx.shippingFee?.toFixed(2)}`}</td>
          </tr>
          <tr style="border-top: 2px solid #E2E8F0;">
            <td style="color: #03045E; font-size: 16px; font-weight: 800; padding-top: 8px;">Total:</td>
            <td align="right" style="color: #03045E; font-size: 18px; font-weight: 800; padding-top: 8px;">₹${ctx.total.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <h4 style="margin-top: 0; color: #334155; font-size: 14px;">Shipping Address</h4>
        <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
          <strong>${ctx.shippingAddress.firstName} ${ctx.shippingAddress.lastName}</strong><br/>
          ${ctx.shippingAddress.street}<br/>
          ${ctx.shippingAddress.city}, ${ctx.shippingAddress.state || ''} ${ctx.shippingAddress.zip}<br/>
          ${ctx.shippingAddress.phone ? `Phone: ${ctx.shippingAddress.phone}` : ''}
        </p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${trackUrl}" class="btn-primary" target="_blank">View Order Status</a>
      </div>
    `;

    return {
      subject: `Order Confirmation #${ctx.orderNumber} — OM Mobile Art 🛍️`,
      html: renderMasterLayout({
        title: `Order Confirmation #${ctx.orderNumber}`,
        preheader: `Thank you for your order #${ctx.orderNumber}. We are preparing your items.`,
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Thank you for your order, ${name}!\n\nOrder Number: #${ctx.orderNumber}\nTotal: ₹${ctx.total.toFixed(2)}\n\nTrack your order status at:\n${trackUrl}`,
    };
  }

  // 6. Payment Successful
  private renderPaymentSuccessful(ctx: PaymentSuccessfulContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Customer';

    const htmlBody = `
      <h2 style="color: #03045E; font-size: 22px; margin-top: 0; font-weight: 700;">Payment Received! 💳</h2>
      <p>Hello ${name},</p>
      <p>We have successfully processed your payment for <strong>Order #${ctx.orderNumber}</strong>.</p>
      
      <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #166534; font-size: 16px;">Transaction Receipt</h3>
        <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 14px;">
          <tr>
            <td style="color: #15803D;">Transaction ID:</td>
            <td align="right" style="font-weight: 700; color: #166534;">${ctx.transactionId}</td>
          </tr>
          <tr>
            <td style="color: #15803D;">Amount Paid:</td>
            <td align="right" style="font-weight: 700; color: #166534;">₹${ctx.amount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="color: #15803D;">Payment Method:</td>
            <td align="right" style="font-weight: 600; color: #166534;">${ctx.paymentMethod}</td>
          </tr>
        </table>
      </div>

      <p style="color: #64748B; font-size: 14px;">Our production team is now crafting your order. You will receive another notification once your parcel is dispatched.</p>
    `;

    return {
      subject: `Payment Successful for Order #${ctx.orderNumber} 💳`,
      html: renderMasterLayout({
        title: 'Payment Receipt',
        preheader: `Payment of ₹${ctx.amount.toFixed(2)} received for Order #${ctx.orderNumber}.`,
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Hello ${name},\n\nYour payment of ₹${ctx.amount.toFixed(2)} for Order #${ctx.orderNumber} has been received.\nTransaction ID: ${ctx.transactionId}\nPayment Method: ${ctx.paymentMethod}`,
    };
  }

  // 7. Order Shipped
  private renderOrderShipped(ctx: OrderShippedContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Customer';
    const trackingUrl = ctx.trackingUrl || `${appFrontendUrl}/shop/pages/profile.html#orders`;

    const htmlBody = `
      <h2 style="color: #03045E; font-size: 22px; margin-top: 0; font-weight: 700;">Your Order is On Its Way! 🚚</h2>
      <p>Great news, ${name}! Your order <strong>#${ctx.orderNumber}</strong> has been packaged and shipped.</p>
      
      <div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #1E40AF; font-size: 16px;">Shipment Details</h3>
        <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 14px;">
          <tr>
            <td style="color: #1D4ED8;">Carrier:</td>
            <td align="right" style="font-weight: 700; color: #1E40AF;">${ctx.carrier}</td>
          </tr>
          <tr>
            <td style="color: #1D4ED8;">Tracking Number:</td>
            <td align="right" style="font-weight: 700; color: #1E40AF;">${ctx.trackingNumber}</td>
          </tr>
          ${ctx.estimatedDeliveryDate ? `
          <tr>
            <td style="color: #1D4ED8;">Est. Delivery:</td>
            <td align="right" style="font-weight: 700; color: #1E40AF;">${ctx.estimatedDeliveryDate}</td>
          </tr>` : ''}
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${trackingUrl}" class="btn-primary" target="_blank">Track Your Package</a>
      </div>
    `;

    return {
      subject: `Your Order #${ctx.orderNumber} Has Shipped! 🚀`,
      html: renderMasterLayout({
        title: 'Order Shipped',
        preheader: `Order #${ctx.orderNumber} is on its way via ${ctx.carrier}.`,
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Hello ${name},\n\nYour order #${ctx.orderNumber} has shipped via ${ctx.carrier}.\nTracking Number: ${ctx.trackingNumber}\nTrack package: ${trackingUrl}`,
    };
  }

  // 8. Out For Delivery
  private renderOutForDelivery(ctx: OutForDeliveryContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Customer';

    const htmlBody = `
      <h2 style="color: #03045E; font-size: 22px; margin-top: 0; font-weight: 700;">Out For Delivery Today! 🛵</h2>
      <p>Hello ${name},</p>
      <p>Your package for <strong>Order #${ctx.orderNumber}</strong> is out for delivery with our delivery partner today.</p>
      
      <div style="background-color: #FEF3C7; border: 1px solid #FDE68A; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0; font-size: 14px; color: #92400E; font-weight: 600;">Delivery Alert:</p>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #78350F;">Please ensure someone is available at your shipping address to receive the parcel.</p>
      </div>
    `;

    return {
      subject: `Out For Delivery Today — Order #${ctx.orderNumber} 🛵`,
      html: renderMasterLayout({
        title: 'Out For Delivery',
        preheader: `Order #${ctx.orderNumber} is out for delivery today!`,
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Hello ${name},\n\nYour order #${ctx.orderNumber} is out for delivery today. Please ensure someone is available at your shipping address.`,
    };
  }

  // 9. Delivered
  private renderDelivered(ctx: DeliveredContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Customer';
    const reviewUrl = ctx.reviewUrl || `${appFrontendUrl}/shop/pages/shop.html`;

    const htmlBody = `
      <h2 style="color: #03045E; font-size: 22px; margin-top: 0; font-weight: 700;">Order Delivered! 🎁</h2>
      <p>Hello ${name},</p>
      <p>Your order <strong>#${ctx.orderNumber}</strong> has been successfully delivered!</p>
      <p>We hope you love your new skin design. Don't forget to check out our installation guide to ensure a bubble-free, flawless fit.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${reviewUrl}" class="btn-primary" target="_blank">Leave a Review</a>
      </div>
    `;

    return {
      subject: `Order #${ctx.orderNumber} Delivered! 🎁`,
      html: renderMasterLayout({
        title: 'Order Delivered',
        preheader: `Order #${ctx.orderNumber} has been delivered. Enjoy your custom skin!`,
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Hello ${name},\n\nYour order #${ctx.orderNumber} has been delivered. We hope you enjoy your custom skin! Leave a review at:\n${reviewUrl}`,
    };
  }

  // 10. Cancelled
  private renderCancelled(ctx: CancelledContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Customer';

    const htmlBody = `
      <h2 style="color: #991B1B; font-size: 22px; margin-top: 0; font-weight: 700;">Order Cancelled — Order #${ctx.orderNumber}</h2>
      <p>Hello ${name},</p>
      <p>Your order <strong>#${ctx.orderNumber}</strong> has been cancelled.</p>
      ${ctx.reason ? `<p><strong>Reason:</strong> ${ctx.reason}</p>` : ''}
      ${ctx.refundAmount ? `<p>A refund of <strong>₹${ctx.refundAmount.toFixed(2)}</strong> has been initiated to your original payment method.</p>` : ''}
    `;

    return {
      subject: `Order #${ctx.orderNumber} Cancellation Notice`,
      html: renderMasterLayout({
        title: 'Order Cancelled',
        preheader: `Cancellation notice for Order #${ctx.orderNumber}.`,
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Hello ${name},\n\nYour order #${ctx.orderNumber} has been cancelled.${ctx.reason ? ` Reason: ${ctx.reason}` : ''}`,
    };
  }

  // 11. Refund Initiated
  private renderRefundInitiated(ctx: RefundInitiatedContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Customer';
    const days = ctx.processingDays || '3-5 business days';

    const htmlBody = `
      <h2 style="color: #03045E; font-size: 22px; margin-top: 0; font-weight: 700;">Refund Initiated 💸</h2>
      <p>Hello ${name},</p>
      <p>A refund of <strong>₹${ctx.amount.toFixed(2)}</strong> for Order #${ctx.orderNumber} has been initiated.</p>
      <p>Refund Reference: <strong>${ctx.refundReference}</strong></p>
      <p style="font-size: 13px; color: #64748B;">Please allow <strong>${days}</strong> for the amount to reflect in your bank account or card statement.</p>
    `;

    return {
      subject: `Refund Initiated for Order #${ctx.orderNumber} 💸`,
      html: renderMasterLayout({
        title: 'Refund Initiated',
        preheader: `Refund of ₹${ctx.amount.toFixed(2)} initiated for Order #${ctx.orderNumber}.`,
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Hello ${name},\n\nA refund of ₹${ctx.amount.toFixed(2)} for Order #${ctx.orderNumber} has been initiated.\nReference: ${ctx.refundReference}\nEstimated processing time: ${days}`,
    };
  }

  // 12. Refund Completed
  private renderRefundCompleted(ctx: RefundCompletedContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Customer';

    const htmlBody = `
      <h2 style="color: #166534; font-size: 22px; margin-top: 0; font-weight: 700;">Refund Completed ✅</h2>
      <p>Hello ${name},</p>
      <p>The refund of <strong>₹${ctx.amount.toFixed(2)}</strong> for Order #${ctx.orderNumber} has been processed successfully.</p>
      <p>Reference ID: <strong>${ctx.refundReference}</strong></p>
    `;

    return {
      subject: `Refund Completed for Order #${ctx.orderNumber} ✅`,
      html: renderMasterLayout({
        title: 'Refund Completed',
        preheader: `Refund of ₹${ctx.amount.toFixed(2)} completed for Order #${ctx.orderNumber}.`,
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Hello ${name},\n\nYour refund of ₹${ctx.amount.toFixed(2)} for Order #${ctx.orderNumber} is complete.\nReference: ${ctx.refundReference}`,
    };
  }

  // 13. Contact Form Auto Reply
  private renderContactFormAutoReply(ctx: ContactFormAutoReplyContext, appFrontendUrl: string): RenderedEmail {
    const name = ctx.recipient.name || 'Friend';

    const htmlBody = `
      <h2 style="color: #03045E; font-size: 22px; margin-top: 0; font-weight: 700;">We Received Your Message! 📩</h2>
      <p>Hello ${name},</p>
      <p>Thank you for reaching out to OM Mobile Art. We have received your inquiry regarding <strong>"${ctx.subject}"</strong>.</p>
      <div style="background-color: #F8FAFC; border-left: 4px solid #0077B6; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #475569;">
        <em>"${ctx.message}"</em>
      </div>
      <p style="font-size: 13px; color: #64748B;">Our support team typically responds within 24 business hours.</p>
    `;

    return {
      subject: `Thank you for contacting OM Mobile Art! 📬`,
      html: renderMasterLayout({
        title: 'Contact Form Acknowledgment',
        preheader: 'We received your message and will respond shortly.',
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `Hello ${name},\n\nThank you for reaching out to OM Mobile Art. We have received your message regarding "${ctx.subject}" and our team will get back to you shortly.`,
    };
  }

  // 14. Contact Form Admin Notification
  private renderContactFormAdminNotification(ctx: ContactFormAdminNotificationContext, appFrontendUrl: string): RenderedEmail {
    const htmlBody = `
      <h2 style="color: #03045E; font-size: 20px; margin-top: 0; font-weight: 700;">New Customer Contact Query 📬</h2>
      <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 14px; border-collapse: collapse;">
        <tr>
          <td style="color: #64748B; width: 120px;">Sender:</td>
          <td style="font-weight: 700; color: #1E293B;">${ctx.senderName} (${ctx.senderEmail})</td>
        </tr>
        ${ctx.phone ? `
        <tr>
          <td style="color: #64748B;">Phone:</td>
          <td style="font-weight: 600; color: #1E293B;">${ctx.phone}</td>
        </tr>` : ''}
        <tr>
          <td style="color: #64748B;">Subject:</td>
          <td style="font-weight: 700; color: #03045E;">${ctx.subject}</td>
        </tr>
      </table>
      <div style="background-color: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 16px; margin-top: 16px; font-size: 14px; color: #334155;">
        ${ctx.message.replace(/\n/g, '<br/>')}
      </div>
    `;

    return {
      subject: `[ADMIN ALERT] New Inquiry from ${ctx.senderName}: ${ctx.subject}`,
      html: renderMasterLayout({
        title: 'New Contact Form Submission',
        preheader: `New message from ${ctx.senderName}: ${ctx.subject}`,
        bodyContent: htmlBody,
        appFrontendUrl,
      }),
      text: `NEW CONTACT FORM SUBMISSION\nFrom: ${ctx.senderName} (${ctx.senderEmail})\nSubject: ${ctx.subject}\nMessage:\n${ctx.message}`,
    };
  }
}

export const emailTemplateService = new EmailTemplateService();
