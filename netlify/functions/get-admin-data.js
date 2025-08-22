const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises; // Import the file system module with promises
const path = require('path');   // Import the path module for resolving file paths

// Initialize a connection pool to your Neon database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Verifies the JWT from the Authorization header.
 * @param {string} authHeader - The value of the 'Authorization' header.
 * @returns {object|null} The decoded token payload if valid, otherwise null.
 */
const verifyToken = (authHeader) => {
  if (!authHeader) {
    return null;
  }
  const token = authHeader.split(' ')[1]; // Expects "Bearer <token>"
  if (!token) {
    return null;
  }
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    console.error("Token verification failed:", e.message);
    return null;
  }
};

exports.handler = async (event) => {
  // --- SECURITY: Verify the request is coming from a logged-in user ---
  const decodedToken = verifyToken(event.headers.authorization);
  if (!decodedToken || !decodedToken.userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const client = await pool.connect();

    // --- SECURITY: Verify the logged-in user has the 'admin' role ---
    const userResult = await client.query('SELECT roles FROM users WHERE id = $1', [decodedToken.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].roles.includes('admin')) {
      client.release();
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin access required' }) };
    }

    // --- CORE LOGIC: Get list of available tools from the project directory ---
    // Use the Netlify-provided environment variable for the repository root to ensure reliability.
    // Fall back to the current directory for local development.
    const rootDir = process.env.NETLIFY_BUILD_BASE || path.resolve('.');
    const files = await fs.readdir(rootDir);
    
    // Define a list of HTML files that are part of the site structure, not assignable tools.
    const nonToolFiles = ['index.html', 'about.html', 'admin.html', '404.html', 'test.html'];
    
    // Filter the file list to get only the HTML files that are actual tools.
    const availableTools = files.filter(file => file.endsWith('.html') && !nonToolFiles.includes(file));

    // --- CORE LOGIC: Fetch all user data from the database ---
    const allUsersResult = await client.query(
      `SELECT u.id, u.email, u.subscription_status, u.roles, u.permitted_tools, c.name as company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       ORDER BY u.email`
    );
    client.release();

    // --- SUCCESS: Return a single JSON object containing both users and the tool list ---
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
