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
  // This is a protected endpoint. A valid token is required.
  const decodedToken = verifyToken(event.headers.authorization);
  if (!decodedToken || !decodedToken.userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const client = await pool.connect();

    // Fetch the user's permissions and ALL tools in parallel for efficiency
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

    const isAdmin = user.roles.includes('admin');
    const isPro = user.subscription_status === 'active';
    const permittedTools = user.permitted_tools || [];

    // Filter the full tool list based on the user's permissions
    const accessibleTools = allTools.filter(tool => {
        if (isAdmin) return true; // Admins see everything
        if (tool.access_level === 'free') return true; // Everyone sees free tools
        if (tool.access_level === 'pro' && isPro) return true; // Pro users see pro tools
        if (permittedTools.includes(tool.filename)) return true; // User sees their specific custom tools
        return false; // Otherwise, hide the tool
    });

    return {
      statusCode: 200,
      body: JSON.stringify(accessibleTools),
    };

  } catch (error) {
    console.error('Get My Tools Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
