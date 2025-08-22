const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon connections
  }
});

exports.handler = async ({ body, headers }) => {
  try {
    // Verify the event came from Stripe
    const event = stripe.webhooks.constructEvent(
      body,
      headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET // Your webhook signing secret
    );

    // Handle the 'checkout.session.completed' event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const neonUserId = session.client_reference_id;

      if (!neonUserId) {
        throw new Error('Webhook received checkout session without a client_reference_id (neonUserId).');
      }
      
      // --- Update the user's status in the Neon database to 'active' ---
      const client = await pool.connect();
      const result = await client.query(
        "UPDATE users SET subscription_status = 'active' WHERE id = $1",
        [neonUserId]
      );
      client.release();

      if (result.rowCount === 0) {
          console.warn(`Webhook handler could not find user with ID: ${neonUserId} to update their subscription.`);
      } else {
          console.log(`Successfully updated subscription status to 'active' for user ${neonUserId}`);
      }
    }
    
    // We can also handle subscription cancellations here
    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;

        const client = await pool.connect();
        const result = await client.query(
            "UPDATE users SET subscription_status = 'cancelled' WHERE stripe_customer_id = $1",
            [stripeCustomerId]
        );
        client.release();
        
        if (result.rowCount > 0) {
            console.log(`Successfully marked subscription as 'cancelled' for stripe customer ${stripeCustomerId}`);
        }
    }


    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error(`Stripe Webhook Error: ${err.message}`);
    // Return a 400 error to Stripe if the signature is invalid
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }
};
