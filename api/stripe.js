const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  pro: 'price_1TVEcMRwFuYQb4HD2nNHQvP2',
  business: 'price_1TVEdhRwFuYQb4HDvq7lrKfb'
};

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { stripeAction } = req.body || {};

  // CHECKOUT
  if (stripeAction === 'checkout') {
    const { plan } = req.body;
    if (!PRICES[plan]) return res.status(400).json({ error: 'Plan invalide' });
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: PRICES[plan], quantity: 1 }],
        success_url: 'https://cuedj.eu/dashboard-dj.html?subscribed=true',
        cancel_url: 'https://cuedj.eu/#pricing',
        locale: 'fr'
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // WEBHOOK — nécessite le raw body
  if (stripeAction === 'webhook') {
    const sig = req.headers['stripe-signature'];
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);
    try {
      const stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
      if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        console.log('✅ Abonnement activé pour:', session.customer_email);
      }
      return res.status(200).json({ received: true });
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  return res.status(400).json({ error: 'stripeAction inconnue' });
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
