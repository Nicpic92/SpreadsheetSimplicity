const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const verifyToken = (authHeader) => {
    if (!authHeader) {
        console.log("verifyToken: No authHeader found.");
        return null;
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        console.log("verifyToken: No token found in header.");
        return null;
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("verifyToken: Token successfully verified for userId:", decoded.userId);
        return decoded;
    } catch (e) {
        console.error("verifyToken: JWT verification FAILED.", e.message);
        return null;
    }
};

exports.handler = async (event) => {
  console.log("--- get-admin-data function invoked ---");
  
  const decodedToken = verifyToken(event.headers.authorization);
  
  if (!decodedToken || !decodedToken.userId) {
    console.error("get-admin-data: Failing with 401. Token was invalid or missing.");
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  console.log(`get-admin-data: Token is valid. Proceeding with admin check for user ID: ${decodedToken.userId}`);

  try {
    const client = await pool.connect();
    
    console.log("get-admin-data: Fetching roles from database...");
    const userResult = await client.query('SELECT roles FROM users WHERE id = $1', [decodedToken.userId]);
    
    if (userResult.rows.length === 0) {
      client.release();
      console.error(`get-admin-data: Failing with 403. User ID ${decodedToken.userId} not found in database.`);
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: User not found' }) };
    }
    
    const userRoles = userResult.rows[0].roles || [];
    console.log(`get-admin-data: Found roles for user: [${userRoles.join(', ')}]`);

    if (!userRoles.includes('admin')) {
      client.release();
      console.error(`get-admin-data: Failing with 403. User does not have 'admin' role.`);
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin access required' }) };
    }

    console.log("get-admin-data: Admin check PASSED. Fetching all user data...");
    
    const allUsersResult = await client.query(
      `SELECT u.id, u.email, u.subscription_status, u.permitted_tools, c.name as company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       ORDER BY c.name, u.email`
    );

    client.release();

    console.log(`get-admin-data: Successfully fetched ${allUsersResult.rows.length} users. Returning 200 OK.`);
    return {
      statusCode: 200,
      body: JSON.stringify(allUsersResult.rows),
    };

  } catch (error) {
    console.error('get-admin-data: CRITICAL DATABASE ERROR.', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
