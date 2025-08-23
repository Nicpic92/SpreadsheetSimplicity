const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

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
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    console.error("Token verification failed:", e.message);
    return null;
  }
};

exports.handler = async (event) => {
  // This is a protected endpoint. A valid token from a logged-in user is required.
  const decodedToken = verifyToken(event.headers.authorization);
  if (!decodedToken || !decodedToken.userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const client = await pool.connect();

    // Fetch the user's data and ALL tools from the database in parallel for efficiency.
    const [userResult, allToolsResult] = await Promise.all([
        client.query('SELECT subscription_status, roles, permitted_tools FROM users WHERE id = $1', [decodedToken.userId]),
        client.query('SELECT filename, display_name, description, access_level, icon_svg FROM tools ORDER BY display_name')
    ]);

    client.release();

    if (userResult.rows.length === 0) {
        return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
    }

    const user = userResult.rows[0];
    const allTools = allToolsResult.rows;

    // Safer admin check
    const isAdmin = user && user.roles && Array.isArray(user.roles) && user.roles.includes('admin');
    const isPro = user.subscription_status === 'active';
    const permittedTools = user.permitted_tools || [];

    // Filter for tools the user CAN currently access
    const accessibleTools = allTools.filter(tool => {
        if (isAdmin) return true; // Admins see everything.
        if (tool.access_level === 'free') return true; // Everyone sees free tools.
        if (tool.access_level === 'pro' && isPro) return true; // Pro subscribers see pro tools.
        if (tool.access_level === 'custom' && permittedTools.includes(tool.filename)) return true; // User sees their assigned custom tools.
        return false;
    });
    
    // NEW: Filter for tools to show in the "Upgrade" section
    // We only create this list if the user is NOT already pro and NOT an admin.
    const upsellTools = isPro || isAdmin ? [] : allTools.filter(tool => tool.access_level === 'pro');

    // Return a single object with both lists
    return {
      statusCode: 200,
      body: JSON.stringify({
          accessibleTools: accessibleTools,
          upsellTools: upsellTools
      }),
    };

  } catch (error) {
    console.error('Get My Tools Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
