const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Create a new pool of connections to your Neon database.
// The pool is more efficient as it reuses connections.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon connections
  }
});

exports.handler = async (event) => {
  // Only allow POST requests to this function
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { email, password } = JSON.parse(event.body);

    // --- Input Validation ---
    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email and password are required.' }) };
    }
    if (password.length < 8) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Password must be at least 8 characters long.' }) };
    }

    // --- Securely Hash the Password ---
    // We use bcryptjs to create a one-way hash of the password.
    // The '10' is the salt round, a measure of computational cost.
    const password_hash = await bcrypt.hash(password, 10);

    // --- Create a Stripe Customer ---
    // Every user needs a Stripe Customer object to handle subscriptions.
    // We store the customer ID to link our user to Stripe's system.
    const customer = await stripe.customers.create({ email });

    // --- Insert User into Neon Database ---
    const client = await pool.connect();
    const result = await client.query(
      'INSERT INTO users (email, password_hash, stripe_customer_id) VALUES ($1, $2, $3) RETURNING id, email, created_at',
      [email.toLowerCase(), password_hash, customer.id]
    );
    client.release();

    // --- Return a Success Response ---
    // Send back the newly created user's ID and email, but NOT the password hash.
    return {
      statusCode: 201, // 201 Created
      body: JSON.stringify(result.rows[0]),
    };

  } catch (error) {
    console.error('Signup Error:', error);

    // --- Handle Specific Errors Gracefully ---
    // If the email already exists, Postgres will throw a '23505' (unique_violation) error.
    if (error.code === '23505') {
      return { statusCode: 409, body: JSON.stringify({ error: 'An account with this email already exists.' }) }; // 409 Conflict
    }

    // For any other errors, return a generic server error.
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
