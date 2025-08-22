const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  console.log("--- INVOKING get-admin-data ---");

  // --- START OF JWT DEBUGGING ---
  const authHeader = event.headers.authorization;
  const jwtSecret = process.env.JWT_SECRET;

  console.log("Received Authorization Header:", authHeader ? "Present" : "MISSING");
  if (authHeader) {
    console.log("Header starts with:", authHeader.substring(0, 15) + "...");
  }
  
  console.log("JWT_SECRET variable:", jwtSecret ? "Present" : "MISSING or empty");
  if (jwtSecret) {
    console.log("JWT_SECRET length:", jwtSecret.length);
    console.log("JWT_SECRET starts with:", jwtSecret.substring(0, 4) + "...");
  }
  // --- END OF JWT DEBUGGING ---

  // Standard token verification
  const decodedToken = (() => {
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    try {
      return jwt.verify(token, jwtSecret);
    } catch (e) {
      console.error("JWT VERIFICATION FAILED:", e.message);
      return null;
    }
  })();

  if (!decodedToken || !decodedToken.userId) {
    console.error("Failing with 401 because token verification failed.");
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // If we get here, the token was verified successfully.
  console.log("Token verification SUCCEEDED for userId:", decodedToken.userId);

  try {
    const client = await pool.connect();
    // Verify admin role
    const userResult = await client.query('SELECT roles FROM users WHERE id = $1', [decodedToken.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].roles.includes('admin')) {
      client.release();
      console.error("Failing with 403 because user is not an admin.");
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin access required' }) };
    }

    // ... (rest of the function remains the same)
    
    const rootDir = process.env.NETLIFY_BUILD_BASE || path.resolve('.');
    const files = await fs.readdir(rootDir);
    const nonToolFiles = ['index.html', 'about.html', 'admin.html', '404.html', 'test.html'];
    const availableTools = files.filter(file => file.endsWith('.html') && !nonToolFiles.includes(file));

    const allUsersResult = await client.query(
      `SELECT u.id, u.email, u.subscription_status, u.roles, u.permitted_tools, c.name as company_name
       FROM users u LEFT JOIN companies c ON u.company_id = c.id ORDER BY u.email`
    );
    client.release();

    return {
      statusCode: 200,
      body: JSON.stringify({ users: allUsersResult.rows, availableTools: availableTools }),
    };
  } catch (error) {
    console.error('Admin Data Fetch Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
