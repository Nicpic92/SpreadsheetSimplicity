const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const verifyToken = (authHeader) => {
  // ... (same verifyToken function)
};

exports.handler = async (event) => {
  const decodedToken = verifyToken(event.headers.authorization);
  if (!decodedToken || !decodedToken.userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const client = await pool.connect();
    // Verify user is an admin
    const userResult = await client.query('SELECT roles FROM users WHERE id = $1', [decodedToken.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].roles.includes('admin')) {
      client.release();
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    // --- NEW: Fetch tools from the database ---
    // We only need the filenames of tools that are 'custom'.
    const toolsResult = await client.query("SELECT filename FROM tools WHERE access_level = 'custom'");
    const availableTools = toolsResult.rows.map(row => row.filename);

    // Fetch all user data
    const allUsersResult = await client.query(
      `SELECT u.id, u.email, u.subscription_status, u.roles, u.permitted_tools, c.name as company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       ORDER BY u.email`
    );
    client.release();

    return {
      statusCode: 200,
      body: JSON.stringify({
        users: allUsersResult.rows,
        availableTools: availableTools // This is now a list of only CUSTOM tools
      }),
    };
  } catch (error) {
    console.error('Admin Data Fetch Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
