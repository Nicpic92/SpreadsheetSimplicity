const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const verifyToken = (authHeader) => {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
};

exports.handler = async (event) => {
  const decodedToken = verifyToken(event.headers.authorization);
  if (!decodedToken) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT id, email, subscription_status FROM users WHERE id = $1', [decodedToken.userId]);
    client.release();
    
    if (result.rows.length === 0) {
      return { statusCode: 404, body: 'User not found' };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result.rows[0]),
    };
  } catch (error) {
    console.error('Get Profile Error:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
