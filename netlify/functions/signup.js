const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, password } = JSON.parse(event.body);
    if (!email || !password) {
      return { statusCode: 400, body: 'Email and password are required.' };
    }

    // Hash the password
    const password_hash = await bcrypt.hash(password, 10);

    // Create a Stripe customer
    const customer = await stripe.customers.create({ email });

    // Insert user into Neon database
    const client = await pool.connect();
    const result = await client.query(
      'INSERT INTO users (email, password_hash, stripe_customer_id) VALUES ($1, $2, $3) RETURNING id, email',
      [email, password_hash, customer.id]
    );
    client.release();

    return {
      statusCode: 201,
      body: JSON.stringify(result.rows[0]),
    };
  } catch (error) {
    console.error('Signup Error:', error);
    if (error.code === '23505') { // Unique constraint violation for email
      return { statusCode: 409, body: 'An account with this email already exists.' };
    }
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
