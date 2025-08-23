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

    // --- Get Tool Info ---
    const client = await pool.connect();
    const toolResult = await client.query('SELECT access_level FROM tools WHERE filename = $1', [filename]);
    
    if (toolResult.rows.length === 0) {
        client.release();
        // If the tool isn't in our database, deny access by default for security.
        return { statusCode: 200, body: JSON.stringify({ hasAccess: false, reason: 'Tool not found in database.' }) };
    }
    const tool = toolResult.rows[0];

    // --- Get User Info ---
    const decodedToken = verifyToken(event.headers.authorization);
    const user = decodedToken ? (await client.query('SELECT subscription_status, roles, permitted_tools FROM users WHERE id = $1', [decodedToken.userId])).rows[0] : null;
    client.release();

    // --- THE CORRECTED PERMISSION LOGIC ---
    let hasAccess = false;
    
    // Rule 1: Anyone can access free tools.
    if (tool.access_level === 'free') {
        hasAccess = true;
    } 
    // Rule 2: If the user exists, check their special permissions.
    else if (user) {
        // Rule 2a: Admins can access everything.
        if (user.roles && user.roles.includes('admin')) {
            hasAccess = true;
        }
        // Rule 2b: Active subscribers can access 'pro' tools.
        else if (tool.access_level === 'pro' && user.subscription_status === 'active') {
            hasAccess = true;
        }
        // Rule 2c: Users with specific permissions can access 'custom' tools.
        else if (tool.access_level === 'custom' && user.permitted_tools && user.permitted_tools.includes(filename)) {
            hasAccess = true;
        }
    }

    return { 
        statusCode: 200, 
        body: JSON.stringify({ hasAccess: hasAccess }) 
    };
};
