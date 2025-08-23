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
    // ADDED FOR DIAGNOSTICS: This will print the database URL to your terminal.
    console.log("--- Connecting to DB:", process.env.DATABASE_URL);

    const { filename } = JSON.parse(event.body);
    console.log(`--- check-access invoked for filename: "${filename}" ---`);

    if (!filename) {
        console.error("Failing: Filename not provided in request body.");
        return { statusCode: 400, body: JSON.stringify({ error: 'Filename is required.' }) };
    }

    const client = await pool.connect();
    
    // --- STEP 1: Get Tool Info ---
    console.log(`Querying 'tools' table for filename: "${filename}"`);
    const toolResult = await client.query('SELECT access_level FROM tools WHERE filename = $1', [filename]);
    
    if (toolResult.rows.length === 0) {
        client.release();
        console.warn(`DENYING ACCESS: Tool "${filename}" not found in the database.`);
        // Return the specific reason for easier debugging on the frontend
        return { statusCode: 200, body: JSON.stringify({ hasAccess: false, reason: 'Tool not found in database.' }) };
    }
    const tool = toolResult.rows[0];
    console.log(`Tool found. Required access_level: "${tool.access_level}"`);

    // --- STEP 2: Get User Info ---
    const decodedToken = verifyToken(event.headers.authorization);
    let user = null;
    if (decodedToken) {
        console.log(`Token is valid for user ID: ${decodedToken.userId}`);
        const userResult = await client.query('SELECT subscription_status, roles, permitted_tools FROM users WHERE id = $1', [decodedToken.userId]);
        if (userResult.rows.length > 0) {
            user = userResult.rows[0];
            console.log("User found in database:", JSON.stringify(user));
        } else {
            console.warn(`User ID from token (${decodedToken.userId}) was not found in the database.`);
        }
    } else {
        console.log("No valid token provided. Treating as a logged-out user.");
    }
    client.release();

    // --- STEP 3: The Permission Logic ---
    let hasAccess = false;
    let reason = "Access denied by default.";
    
    if (tool.access_level === 'free') {
        hasAccess = true;
        reason = "Access granted: Tool is free.";
    } 
    else if (user) { // Only proceed if a user is logged in
        if (user.roles && user.roles.includes('admin')) {
            hasAccess = true;
            reason = "Access granted: User is an admin.";
        }
        else if (tool.access_level === 'pro' && user.subscription_status === 'active') {
            hasAccess = true;
            reason = "Access granted: User has an active subscription for a pro tool.";
        }
        else if (tool.access_level === 'custom' && user.permitted_tools && user.permitted_tools.includes(filename)) {
            hasAccess = true;
            reason = "Access granted: User has specific permission for this custom tool.";
        }
    }

    console.log(`FINAL DECISION: hasAccess = ${hasAccess}. Reason: ${reason}`);
    
    return { 
        statusCode: 200, 
        body: JSON.stringify({ hasAccess: hasAccess }) 
    };
};
