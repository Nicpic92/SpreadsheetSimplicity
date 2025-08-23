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

    console.log(`[INFO] check-access function received request for filename: "${filename}"`);

    if (!filename) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Filename is required.' }) };
    }

    let client;
    try {
        client = await pool.connect();
        
        const toolResult = await client.query('SELECT access_level FROM tools WHERE LOWER(filename) = LOWER($1)', [filename]);
        
        if (toolResult.rows.length === 0) {
            // --- ENHANCED LOGGING BLOCK ---
            console.error(`[CRITICAL] Filename lookup failed for: "${filename}"`);
            
            // Query for ALL tool filenames in the database to see what's available.
            const allToolsResult = await client.query('SELECT filename FROM tools');
            const availableFilenames = allToolsResult.rows.map(row => row.filename);
            
            console.log('[DEBUG] Available filenames in the database are:', availableFilenames);
            // --- END OF ENHANCED LOGGING ---

            return { statusCode: 200, body: JSON.stringify({ hasAccess: false, reason: 'Tool not found in database.' }) };
        }
        
        const tool = toolResult.rows[0];
        console.log(`[INFO] Found tool in database. Access level: "${tool.access_level}"`);

        const decodedToken = verifyToken(event.headers.authorization);
        let user = null;
        if (decodedToken) {
            const userResult = await client.query('SELECT subscription_status, roles, permitted_tools FROM users WHERE id = $1', [decodedToken.userId]);
            if (userResult.rows.length > 0) {
                user = userResult.rows[0];
            }
        }

        let hasAccess = false;
        if (tool.access_level === 'free') {
            hasAccess = true;
        } 
        else if (user) {
            const isAdmin = user && user.roles && Array.isArray(user.roles) && user.roles.includes('admin');
            const isPro = user.subscription_status === 'active';
            const permittedTools = user.permitted_tools || [];

            if (isAdmin) {
                hasAccess = true;
            } else if (tool.access_level === 'pro' && isPro) {
                hasAccess = true;
            } else if (tool.access_level === 'custom' && permittedTools.includes(filename)) {
                hasAccess = true;
            }
        }
        
        console.log(`[INFO] Final decision for "${filename}": hasAccess = ${hasAccess}`);
        return { statusCode: 200, body: JSON.stringify({ hasAccess }) };

    } catch (error) {
        console.error('Check Access CRITICAL Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
    } finally {
        if (client) client.release();
    }
};
