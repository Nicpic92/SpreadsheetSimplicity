const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({ /* ... connection config ... */ });
const verifyToken = (authHeader) => { /* ... same verify function ... */ };

exports.handler = async (event) => {
    const { filename } = JSON.parse(event.body);
    if (!filename) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Filename is required.' }) };
    }

    const decodedToken = verifyToken(event.headers.authorization);
    const user = decodedToken ? (await pool.query('SELECT * FROM users WHERE id = $1', [decodedToken.userId])).rows[0] : null;

    const toolResult = await pool.query('SELECT access_level FROM tools WHERE filename = $1', [filename]);
    if (toolResult.rows.length === 0) {
        return { statusCode: 200, body: JSON.stringify({ hasAccess: false, reason: 'Tool not found.' }) };
    }
    const tool = toolResult.rows[0];

    let hasAccess = false;
    
    if (tool.access_level === 'free') {
        hasAccess = true;
    } else if (user && user.roles.includes('admin')) {
        hasAccess = true;
    } else if (tool.access_level === 'pro' && user && user.subscription_status === 'active') {
        hasAccess = true;
    } else if (tool.access_level === 'custom' && user && user.permitted_tools.includes(filename)) {
        hasAccess = true;
    }

    return { statusCode: 200, body: JSON.stringify({ hasAccess }) };
};
