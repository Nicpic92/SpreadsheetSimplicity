const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises; // Import the file system module
const path = require('path');   // Import the path module

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ... (keep the verifyToken function as it is) ...
const verifyToken = (authHeader) => {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch (e) { return null; }
};

exports.handler = async (event) => {
  const decodedToken = verifyToken(event.headers.authorization);
  if (!decodedToken || !decodedToken.userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const client = await pool.connect();
    const userResult = await client.query('SELECT roles FROM users WHERE id = $1', [decodedToken.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].roles.includes('admin')) {
      client.release();
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin access required' }) };
    }

    // --- NEW: Get list of available tools ---
    const files = await fs.readdir(path.resolve('.'));
    const nonToolFiles = ['index.html', 'about.html', 'admin.html', '404.html'];
    const availableTools = files.filter(file => file.endsWith('.html') && !nonToolFiles.includes(file));

    // --- Fetch all user data (as before) ---
    const allUsersResult = await client.query(
      `SELECT u.id, u.email, u.subscription_status, u.roles, u.permitted_tools, c.name as company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       ORDER BY u.email`
    );
    client.release();

    // --- Return both users and tools in the response ---
    return {
      statusCode: 200,
      body: JSON.stringify({
        users: allUsersResult.rows,
        availableTools: availableTools
      }),
    };

  } catch (error) {
    console.error('Admin Data Fetch Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
