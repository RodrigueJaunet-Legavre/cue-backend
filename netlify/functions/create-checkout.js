const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  pro: 'price_1TVEcMRwFuYQb4HD2nNHQvP2',
  business: 'price_1TVEdhRwFuYQb4HDvq7lrKfb'
};

exports.handler = async (event) => {
  console.log('Body reçu:', event.body);
  console.log('STRIPE_SECRET_KEY présent:', !!process.env.STRIPE_SECRET_KEY);
  console.log('PRICES:', PRICES);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { plan } = JSON.parse(event.body);
    console.log('Plan demandé:', plan);

    if (!PRICES[plan]) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Plan invalide' }) };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRICES[plan], quantity: 1 }],
      success_url: 'https://cuedj.eu/dashboard.html?subscribed=true',
      cancel_url: 'https://cuedj.eu/#pricing',
      locale: 'fr'
    });

    console.log('Session URL:', session.url);

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
