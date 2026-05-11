const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  pro: 'price_1TVEcMRwFuYQb4HD2nNHQvP2',
  business: 'price_1TVEdhRwFuYQb4HDvq7lrKfb'
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

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
