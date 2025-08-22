const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const verifyToken = (authHeader) => {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
};

exports.handler = async (event) => {
  const decodedToken = verifyToken(event.headers.authorization);
  if (!decodedToken) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT stripe_customer_id, email FROM users WHERE id = $1', [decodedToken.userId]);
    client.release();

    if (result.rows.length === 0) {
      return { statusCode: 404, body: 'User not found' };
    }
    
    const user = result.rows[0];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: process.env.STRIPE_PRICE_ID, // Ensure you have this in Netlify env
        quantity: 1,
      }],
      success_url: process.env.SITE_URL || 'https://spreadsheetsimplicity.com',
      cancel_url: process.env.SITE_URL || 'https://spreadsheetsimplicity.com',
      // We now pass our Neon user ID to the webhook
      client_reference_id: decodedToken.userId, 
      customer: user.stripe_customer_id, // Use the existing Stripe customer ID
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id }),
    };
  } catch (error) {
    console.error('Checkout Session Error:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
