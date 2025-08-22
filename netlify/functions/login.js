const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  
  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email and password are required.' }) };
    }

    // --- Find the User in the Database ---
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    client.release();

    // If no user is found with that email, return a generic "Unauthorized" error.
    // We do this to prevent "user enumeration" attacks.
    if (result.rows.length === 0) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid credentials.' }) };
    }

    const user = result.rows[0];

    // --- Compare the Provided Password with the Stored Hash ---
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    // If passwords don't match, return the same generic error.
    if (!passwordMatch) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid credentials.' }) };
    }

    // --- Create a JSON Web Token (JWT) ---
    // This token is the user's session. It contains their user ID and email.
    // It's signed with your JWT_SECRET, so we can trust it on future requests.
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        // We can add the user's subscription status to the token payload
        // so we don't have to look it up on every request.
        subscriptionStatus: user.subscription_status 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // The token will be valid for 7 days
    );

    // --- Return the Token to the Client ---
    // The client-side code will store this token and send it with future requests.
    return {
      statusCode: 200,
      body: JSON.stringify({ token }),
    };

  } catch (error) {
    console.error('Login Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
