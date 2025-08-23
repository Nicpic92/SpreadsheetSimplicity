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
    const { filename } = JSON.parse(event.body);
    if (!filename) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Filename is required.' }) };
    }

    const client = await pool.connect();
    const toolResult = await client.query('SELECT access_level FROM tools WHERE filename = $1', [filename]);
    
    if (toolResult.rows.length === 0) {
        client.release();
        return { statusCode: 200, body: JSON.stringify({ hasAccess: false, reason: 'Tool not found in database.' }) };
    }
    
    const tool = toolResult.rows[0];
    const decodedToken = verifyToken(event.headers.authorization);
    let user = null;
    if (decodedToken) {
        const userResult = await client.query('SELECT subscription_status, roles, permitted_tools FROM users WHERE id = $1', [decodedToken.userId]);
        if (userResult.rows.length > 0) {
            user = userResult.rows[0];
        }
    }
    client.release();

    let hasAccess = false;
    if (tool.access_level === 'free') {
        hasAccess = true;
    } 
    else if (user) {
        if (user.roles && user.roles.includes('admin')) {
            hasAccess = true;
        }
        // Other checks are here...
    }
    
    // --- NEW DEBUGGING LOGIC ---
    if (hasAccess) {
        return { statusCode: 200, body: JSON.stringify({ hasAccess: true }) };
    } else {
        // If access is denied, send back a rich debug object
        return { 
            statusCode: 200, 
            body: JSON.stringify({ 
                hasAccess: false,
                debug: {
                    reason: "Access was denied. Checking user data...",
                    tool_filename: filename,
                    tool_access_level: tool.access_level,
                    user_found: !!user,
                    user_data_from_db: user, // The full user object from Neon
                    is_roles_an_array: Array.isArray(user ? user.roles : null), // Is it a true array?
                    typeof_roles: typeof (user ? user.roles : null) // Is it a 'string' or 'object'?
                }
            }) 
        };
    }
};
