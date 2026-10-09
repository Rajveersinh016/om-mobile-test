export interface ISMSProvider {
  sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export class MockSMSProvider implements ISMSProvider {
  async sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log(`[MockSMSProvider] 📱 Sending SMS to: ${to}`);
    console.log(`[MockSMSProvider] 💬 Content: "${message}"`);
    return {
      success: true,
      messageId: `mock-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
  }
}

export class SMSFactory {
  private static instance: ISMSProvider | null = null;

  public static getProvider(): ISMSProvider {
    if (this.instance) {
      return this.instance;
    }

    const providerType = (process.env.SMS_PROVIDER || 'mock').toLowerCase();

    switch (providerType) {
      case 'mock':
      default:
        this.instance = new MockSMSProvider();
        break;
    }

    return this.instance;
  }

  // Useful for resetting or injecting mock in tests
  public static setProvider(provider: ISMSProvider | null): void {
    this.instance = provider;
  }
}

export const smsProvider = SMSFactory.getProvider();
