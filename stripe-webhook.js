const stripe = require('stripe')(process.env.STRIPE_WEBHOOK_SECRET);
const { ManagementClient } = require('auth0');

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN.replace('https://', ''),
  clientId: process.env.AUTH0_M2M_CLIENT_ID,
  clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET,
});

exports.handler = async ({ body, headers }) => {
  try {
    const event = stripe.webhooks.constructEvent(
      body,
      headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const auth0UserId = session.client_reference_id;
      const proRoleId = process.env.AUTH0_PRO_ROLE_ID;

      if (!auth0UserId || !proRoleId) {
        throw new Error('Missing user ID or role ID in webhook.');
      }

      await auth0.users.assignRoles({ id: auth0UserId }, { roles: [proRoleId] });
      
      console.log(`Successfully assigned pro role to user ${auth0UserId}`);
    }

    return { statusCode: 200, body: 'success' };
  } catch (err) {
    console.error(`Stripe Webhook Error: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }
};