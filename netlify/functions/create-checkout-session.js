const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper function to verify the JWT from the request headers
const verifyToken = (authHeader) => {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    console.error('Token verification failed:', e.message);
    return null;
  }
};

exports.handler = async (event) => {
  // --- Verify the user is logged in ---
  const decodedToken = verifyToken(event.headers.authorization);
  if (!decodedToken || !decodedToken.userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: Invalid or missing token.' }) };
  }

  try {
    // --- Get the user's Stripe Customer ID from our database ---
    const client = await pool.connect();
    const result = await client.query('SELECT stripe_customer_id FROM users WHERE id = $1', [decodedToken.userId]);
    client.release();

    if (result.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'User not found in database.' }) };
    }
    
    const user = result.rows[0];
    if (!user.stripe_customer_id) {
        return { statusCode: 500, body: JSON.stringify({ error: 'User is missing a Stripe customer ID.' }) };
    }

    // --- Create the Stripe Checkout Session ---
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: process.env.STRIPE_PRICE_ID, // Ensure this env variable is set in Netlify
        quantity: 1,
      }],
      success_url: `${process.env.SITE_URL}/`, // Redirect to homepage on success
      cancel_url: `${process.env.SITE_URL}/`,  // Redirect to homepage on cancellation
      
      // Pass our Neon user ID to the webhook for identifying the user after payment.
      client_reference_id: decodedToken.userId, 
      
      // Use the existing Stripe customer ID to avoid creating duplicate customers.
      customer: user.stripe_customer_id,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id }),
    };

  } catch (error) {
    console.error('Create Checkout Session Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
