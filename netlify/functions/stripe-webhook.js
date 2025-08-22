const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Use secret key here
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

exports.handler = async ({ body, headers }) => {
  try {
    const event = stripe.webhooks.constructEvent(
      body,
      headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET // Ensure this is in Netlify env
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const neonUserId = session.client_reference_id;

      if (!neonUserId) {
        throw new Error('Missing user ID in webhook session.');
      }
      
      // Update the user's status in the Neon database
      const client = await pool.connect();
      await client.query(
        "UPDATE users SET subscription_status = 'active' WHERE id = $1",
        [neonUserId]
      );
      client.release();
      
      console.log(`Successfully updated subscription status for user ${neonUserId}`);
    }

    return { statusCode: 200, body: 'success' };
  } catch (err) {
    console.error(`Stripe Webhook Error: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }
};
