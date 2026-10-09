import 'dotenv/config';
import { razorpayClient } from '../services/payment/razorpayClient.js';

async function main() {
  console.log('Testing createOrder with RazorpayClient...');
  try {
    const order = await razorpayClient.createOrder(129900, 'INR', `test_${Date.now()}`);
    console.log('Order created successfully:', order);
  } catch (err: any) {
    console.error('createOrder failed:', err.message || err);
  }
}

main();
