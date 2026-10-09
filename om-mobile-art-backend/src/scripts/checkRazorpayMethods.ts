import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  console.log('Testing Razorpay Account:', keyId);
  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  try {
    const res = await fetch('https://api.razorpay.com/v1/methods', {
      headers: {
        Authorization: authHeader,
      }
    });

    console.log('Response status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (err: any) {
    console.error('Fetch error:', err.message || err);
  }
}

main();
