const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

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
  const decodedToken = verifyToken(event.headers.authorization);
  if (!decodedToken || !decodedToken.userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const client = await pool.connect();
    
    // Verify the requesting user is an admin
    const userResult = await client.query('SELECT roles FROM users WHERE id = $1', [decodedToken.userId]);
    
    const user = userResult.rows[0];
    const isAdmin = user && user.roles && Array.isArray(user.roles) && user.roles.includes('admin');

    if (userResult.rows.length === 0 || !isAdmin) {
      client.release();
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin access required' }) };
    }

    // Fetch all "custom" tools that can be assigned
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
        availableTools: availableTools
      }),
    };

  } catch (error) {
    console.error('ADMIN DATA FETCH ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
