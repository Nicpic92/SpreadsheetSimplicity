const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const verifyToken = (authHeader) => {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch (e) { return null; }
};

exports.handler = async (event) => {
  console.log("--- get-admin-data function invoked ---");

  const decodedToken = verifyToken(event.headers.authorization);
  if (!decodedToken || !decodedToken.userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const client = await pool.connect();
    console.log("Database connection successful.");

    const userResult = await client.query('SELECT roles FROM users WHERE id = $1', [decodedToken.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].roles.includes('admin')) {
      client.release();
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin access required' }) };
    }
    console.log("Admin role verified.");

    // --- DEBUGGING THE TOOLS QUERY ---
    console.log("Querying for tools with access_level = 'custom'...");
    const toolsResult = await client.query("SELECT filename, access_level FROM tools WHERE access_level = 'custom'");
    
    // THIS IS THE MOST IMPORTANT LOG
    console.log("Result from tools query:", JSON.stringify(toolsResult.rows, null, 2));
    console.log("Number of custom tools found:", toolsResult.rowCount);
    
    const availableTools = toolsResult.rows.map(row => row.filename);

    // --- Fetch all user data ---
    console.log("Fetching all user data...");
    const allUsersResult = await client.query(
      `SELECT u.id, u.email, u.subscription_status, u.roles, u.permitted_tools, c.name as company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       ORDER BY u.email`
    );
    client.release();
    console.log("Successfully fetched all user data.");

    return {
      statusCode: 200,
      body: JSON.stringify({
        users: allUsersResult.rows,
        availableTools: availableTools
      }),
    };

  } catch (error) {
    console.error('--- ADMIN DATA FETCH CRITICAL ERROR ---:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
