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
    // We will get the filename from the request
    const { filename } = JSON.parse(event.body);

    if (!filename) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Filename is required.' }) };
    }

    const client = await pool.connect();
    
    // Query the database for the tool
    const toolResult = await client.query('SELECT access_level FROM tools WHERE filename = $1', [filename]);
    
    // --- THIS IS THE CRITICAL LOGIC BLOCK ---
    if (toolResult.rows.length === 0) {
        client.release();
        
        // ** ENHANCED DIAGNOSTIC RESPONSE **
        // If the tool is not found, we send a detailed debug message back to the browser.
        // We do not send the full URL for security, only the host information.
        const dbHostInfo = process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1] : 'DATABASE_URL not set!';

        return { 
            statusCode: 200, 
            body: JSON.stringify({ 
                hasAccess: false, 
                reason: 'Tool not found in database.',
                // This debug block will appear in your browser's Network tab
                debug: {
                    database_host: dbHostInfo,
                    filename_searched: filename
                }
            }) 
        };
    }

    // If the tool was found, proceed with the normal permission logic
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
        else if (tool.access_level === 'pro' && user.subscription_status === 'active') {
            hasAccess = true;
        }
        else if (tool.access_level === 'custom' && user.permitted_tools && user.permitted_tools.includes(filename)) {
            hasAccess = true;
        }
    }
    
    return { 
        statusCode: 200, 
        body: JSON.stringify({ hasAccess: hasAccess }) 
    };
};
