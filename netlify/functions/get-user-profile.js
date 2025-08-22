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
  if (!authHeader) {
    return null;
  }

  const token = authHeader.split(' ')[1]; // Format is "Bearer <token>"
  if (!token) {
    return null;
  }
  
  try {
    // This will throw an error if the token is invalid or expired
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    console.error('Token verification failed:', e.message);
    return null;
  }
};

exports.handler = async (event) => {
  const decodedToken = verifyToken(event.headers.authorization);

  if (!decodedToken || !decodedToken.userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: Invalid or missing token.' }) };
  }
  
  try {
    const client = await pool.connect();
    
    // Fetch all the necessary user data: roles for security and permitted_tools for custom access
    const result = await client.query(
      'SELECT id, email, subscription_status, roles, permitted_tools FROM users WHERE id = $1',
      [decodedToken.userId]
    );
    client.release();
    
    if (result.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
    }

    // Return the user's profile
    return {
      statusCode: 200,
      body: JSON.stringify(result.rows[0]),
    };

  } catch (error) {
    console.error('Get Profile Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
