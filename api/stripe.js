const Stripe = require('stripe');
const postgres = require('postgres');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const PRICES = {
  pro:      'price_1TVEcMRwFuYQb4HD2nNHQvP2',
  business: 'price_1TVEdhRwFuYQb4HDvq7lrKfb'
};

const PRICE_TO_PLAN = Object.fromEntries(Object.entries(PRICES).map(([k, v]) => [v, k]));

module.exports = async function handler(req, res) {
  // Webhook Stripe — détecté via stripe-signature ou ?webhook=true
  if (req.query?.webhook === 'true' || req.headers['stripe-signature']) {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const plan = session.metadata?.plan || PRICE_TO_PLAN[session.amount_subtotal] || 'pro';
        const userId = session.metadata?.userId;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        if (userId) {
          await sql`
            UPDATE users SET
              plan = ${plan},
              stripe_customer_id     = ${customerId || null},
              stripe_subscription_id = ${subscriptionId || null}
            WHERE id = ${userId}
          `;
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await sql`UPDATE users SET plan = 'starter', stripe_subscription_id = NULL WHERE stripe_customer_id = ${sub.customer}`;
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await sql`UPDATE users SET plan = 'starter' WHERE stripe_customer_id = ${invoice.customer}`;
        break;
      }
      default:
        console.log('Événement Stripe ignoré:', event.type);
    }

    return res.status(200).json({ received: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = req.body || {};
  const action = body.action || body.stripeAction;

  // CREATE CHECKOUT SESSION
  if (action === 'create_checkout' || action === 'checkout') {
    const { priceId, plan, userId, email, successUrl, cancelUrl } = body;

    const resolvedPriceId = priceId || PRICES[plan];
    if (!resolvedPriceId) return res.status(400).json({ error: 'Plan ou priceId invalide' });

    const resolvedSuccessUrl = successUrl || `https://cuedj.eu/dashboard-dj.html?sub_success=${PRICE_TO_PLAN[resolvedPriceId] || 'pro'}`;
    const resolvedCancelUrl  = cancelUrl  || 'https://cuedj.eu/dashboard-dj.html';

    try {
      // Récupère ou crée le customer Stripe pour cet utilisateur
      let customerId;
      if (userId) {
        const [userRow] = await sql`SELECT stripe_customer_id FROM users WHERE id = ${userId}`;
        customerId = userRow?.stripe_customer_id;
      }

      if (!customerId && email) {
        const existing = await stripe.customers.list({ email, limit: 1 });
        customerId = existing.data[0]?.id;
      }

      if (!customerId && email) {
        const customer = await stripe.customers.create({ email, metadata: { userId: userId || '' } });
        customerId = customer.id;
        if (userId) {
          await sql`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${userId}`.catch(() => {});
        }
      }

      const sessionParams = {
        mode: 'subscription',
        line_items: [{ price: resolvedPriceId, quantity: 1 }],
        success_url: resolvedSuccessUrl,
        cancel_url:  resolvedCancelUrl,
        locale: 'fr',
        metadata: { userId: userId || '' }
      };
      if (customerId) sessionParams.customer = customerId;
      else if (email)  sessionParams.customer_email = email;

      const session = await stripe.checkout.sessions.create(sessionParams);
      return res.status(200).json({ url: session.url, sessionId: session.id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // CANCEL SUBSCRIPTION
  if (action === 'cancel_subscription') {
    const { userId } = body;
    if (!userId) return res.status(400).json({ error: 'userId requis' });

    try {
      const [userRow] = await sql`SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = ${userId}`;

      let cancelled = false;

      // Annule via subscription_id direct si dispo
      if (userRow?.stripe_subscription_id) {
        await stripe.subscriptions.cancel(userRow.stripe_subscription_id);
        cancelled = true;
      }
      // Sinon cherche via customer_id
      else if (userRow?.stripe_customer_id) {
        const subs = await stripe.subscriptions.list({
          customer: userRow.stripe_customer_id,
          status: 'active',
          limit: 10
        });
        for (const sub of subs.data) {
          await stripe.subscriptions.cancel(sub.id);
          cancelled = true;
        }
      }

      if (!cancelled) {
        return res.status(400).json({ error: 'Aucun abonnement actif trouvé' });
      }

      // Remet le plan à starter en DB
      await sql`UPDATE users SET plan = 'starter', stripe_subscription_id = NULL WHERE id = ${userId}`;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // BILLING PORTAL — gestion abonnement côté Stripe
  if (action === 'billing_portal') {
    const { userId, returnUrl } = body;
    try {
      const [userRow] = await sql`SELECT stripe_customer_id FROM users WHERE id = ${userId}`;
      if (!userRow?.stripe_customer_id) return res.status(400).json({ error: 'Pas de customer Stripe' });

      const session = await stripe.billingPortal.sessions.create({
        customer: userRow.stripe_customer_id,
        return_url: returnUrl || 'https://cuedj.eu/dashboard-dj.html'
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'action inconnue' });
};
