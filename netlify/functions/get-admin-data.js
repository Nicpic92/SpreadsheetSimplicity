const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper function to verify the JWT
const verifyToken = (authHeader) => {
    // ... (same verifyToken function as in your other files)
};

exports.handler = async (event) => {
  const decodedToken = verifyToken(event.headers.authorization);
  
  // --- SECURITY CHECK ---
  // 1. Check if token is valid
  if (!decodedToken || !decodedToken.userId) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    const client = await pool.connect();
    
    // 2. Fetch the current user's roles from the database
    const userResult = await client.query('SELECT roles FROM users WHERE id = $1', [decodedToken.userId]);
    if (userResult.rows.length === 0) {
      client.release();
      return { statusCode: 403, body: 'Forbidden: User not found' };
    }
    
    // 3. Check if the user has the 'admin' role
    const userRoles = userResult.rows[0].roles || [];
    if (!userRoles.includes('admin')) {
      client.release();
      return { statusCode: 403, body: 'Forbidden: Admin access required' };
    }

    // --- If security checks pass, fetch all data ---
    const allUsersResult = await client.query(
      `SELECT u.id, u.email, u.subscription_status, u.permitted_tools, c.name as company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       ORDER BY c.name, u.email`
    );

    client.release();

    return {
      statusCode: 200,
      body: JSON.stringify(allUsersResult.rows),
    };

  } catch (error) {
    console.error('Admin Data Fetch Error:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
