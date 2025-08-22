const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ... (copy the same verifyToken function here) ...
const verifyToken = (authHeader) => {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch (e) { return null; }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // --- SECURITY: First, verify the person making the request is an admin ---
  const decodedToken = verifyToken(event.headers.authorization);
  if (!decodedToken || !decodedToken.userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const client = await pool.connect();
    const adminResult = await client.query('SELECT roles FROM users WHERE id = $1', [decodedToken.userId]);
    if (adminResult.rows.length === 0 || !adminResult.rows[0].roles.includes('admin')) {
      client.release();
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin access required' }) };
    }

    // --- If admin check passes, proceed with the update ---
    const { userIdToUpdate, tools } = JSON.parse(event.body);

    if (!userIdToUpdate || !Array.isArray(tools)) {
      client.release();
      return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: Missing userId or tools array.' }) };
    }

    await client.query(
      'UPDATE users SET permitted_tools = $1 WHERE id = $2',
      [tools, userIdToUpdate]
    );

    client.release();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Permissions updated successfully.' }),
    };

  } catch (error) {
    console.error('Update Permissions Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
