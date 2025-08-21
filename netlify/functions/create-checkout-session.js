const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  const { user } = context.clientContext;

  if (!user) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{
      price: process.env.STRIPE_PRICE_ID,
      quantity: 1,
    }],
    success_url: `${process.env.SITE_URL}/`,
    cancel_url: `${process.env.SITE_URL}/`,
    client_reference_id: user.sub,
    customer_email: user.email,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ sessionId: session.id }),
  };
};
