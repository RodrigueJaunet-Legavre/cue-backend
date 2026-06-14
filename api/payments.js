const Stripe = require('stripe');
const postgres = require('postgres');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = req.body;
  const { action } = body;

  // Venue initie le paiement
  if (action === 'create_payment') {
    const { bookingId, djId, venueId, amount } = body;
    try {
      const [dj] = await sql`SELECT plan FROM users WHERE id = ${djId}`;
      const plan = dj?.plan || 'starter';
      const commissions = { starter: 0.15, pro: 0.05, business: 0.00, founder: 0.00 };
      const commission = commissions[plan] ?? 0.15;
      const totalCents = Math.round(parseFloat(amount) * 100);
      const commissionCents = Math.round(totalCents * commission);
      const djCents = totalCents - commissionCents;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: 'eur',
        metadata: { bookingId, djId, venueId },
        description: `Booking CUE #${bookingId}`
      });

      await sql`
        UPDATE bookings SET
          payment_intent_id = ${paymentIntent.id},
          payment_status = 'pending_payment',
          commission_amount = ${commissionCents / 100},
          dj_amount = ${djCents / 100}
        WHERE id = ${bookingId}
      `;

      return res.status(200).json({
        clientSecret: paymentIntent.client_secret,
        total: amount,
        djReceives: djCents / 100,
        commissionPct: Math.round(commission * 100)
      });
    } catch (err) {
      console.log('❌ create_payment error:', err.message, { bookingId, djId, venueId, amount });
      return res.status(500).json({ error: err.message });
    }
  }

  // Webhook Stripe — paiement reçu
  if (action === 'webhook') {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      await sql`
        UPDATE bookings SET payment_status = 'paid'
        WHERE payment_intent_id = ${pi.id}
      `;
    }
    return res.status(200).json({ received: true });
  }

  // Venue valide la prestation
  if (action === 'validate_prestation') {
    const { bookingId, venueId } = body;
    try {
      const [booking] = await sql`
        SELECT b.*,
               dj.first_name as dj_first, dj.last_name as dj_last,
               dj.email as dj_email, dj.iban, dj.bic, dj.bank_name
        FROM bookings b
        LEFT JOIN users dj ON b.dj_id = dj.id
        WHERE b.id = ${bookingId} AND b.venue_id = ${venueId}
      `;
      if (!booking) return res.status(404).json({ error: 'Booking non trouvé' });
      if (booking.payment_status === 'released') {
        return res.status(400).json({ error: 'Déjà validé' });
      }

      await sql`
        UPDATE bookings SET
          payment_status = 'released',
          payout_status = 'to_pay',
          released_at = NOW()
        WHERE id = ${bookingId}
      `;

      // Email au DJ
      await fetch(process.env.URL + '/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'payment_validated',
          email: booking.dj_email,
          firstName: booking.dj_first,
          amount: booking.dj_amount,
          iban: booking.iban,
          bookingDate: booking.event_date
        })
      });

      // Email à l'admin pour virement
      await fetch(process.env.URL + '/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'admin_payout',
          email: process.env.ADMIN_EMAIL,
          djName: booking.dj_first + ' ' + booking.dj_last,
          amount: booking.dj_amount,
          iban: booking.iban,
          bic: booking.bic,
          bankName: booking.bank_name,
          bookingId
        })
      });

      return res.status(200).json({ success: true, djAmount: booking.dj_amount });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Venue signale un problème
  if (action === 'dispute') {
    const { bookingId, venueId, reason } = body;
    try {
      const [booking] = await sql`
        SELECT b.*,
               dj.email as dj_email,
               v.first_name as venue_first, v.last_name as venue_last,
               v.email as venue_email
        FROM bookings b
        LEFT JOIN users dj ON b.dj_id = dj.id
        LEFT JOIN users v ON b.venue_id = v.id
        WHERE b.id = ${bookingId}
      `;

      await sql`
        UPDATE bookings SET
          payment_status = 'disputed',
          dispute_reason = ${reason},
          disputed_at = NOW()
        WHERE id = ${bookingId}
      `;

      await fetch(process.env.URL + '/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'admin_dispute',
          email: process.env.ADMIN_EMAIL,
          bookingId,
          venueName: (booking?.venue_first || '') + ' ' + (booking?.venue_last || ''),
          venueEmail: booking?.venue_email,
          reason
        })
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Admin marque le virement effectué
  if (action === 'mark_paid') {
    const { bookingId, adminSecret } = body;
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    try {
      await sql`UPDATE bookings SET payout_status = 'paid' WHERE id = ${bookingId}`;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'cancel_booking') {
    const { bookingId, userId, reason } = body;
    try {
      const [booking] = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
      if (!booking) return res.status(404).json({ error: 'Booking non trouvé' });

      if (booking.dj_id !== userId && booking.venue_id !== userId) {
        return res.status(403).json({ error: 'Non autorisé' });
      }

      const eventDate = new Date(booking.event_date);
      const daysUntil = Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 7) {
        return res.status(400).json({ error: 'Annulation impossible à moins de 7 jours de la prestation' });
      }

      await sql`
        UPDATE bookings SET
          status = 'cancelled',
          notes = COALESCE(notes || ' | ', '') || ${'Annulé: ' + (reason || 'Sans motif')},
          updated_at = NOW()
        WHERE id = ${bookingId}
      `;

      if (booking.payment_intent_id && booking.payment_status === 'paid') {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.refunds.create({ payment_intent: booking.payment_intent_id });
        await sql`UPDATE bookings SET payment_status = 'refunded' WHERE id = ${bookingId}`;
      }

      const otherPartyId = booking.dj_id === userId ? booking.venue_id : booking.dj_id;
      const [otherParty] = await sql`SELECT email, first_name FROM users WHERE id = ${otherPartyId}`;
      const [canceller] = await sql`SELECT first_name, stage_name FROM users WHERE id = ${userId}`;

      if (otherParty) {
        await fetch('https://cuedj.eu/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'booking_cancelled',
            email: otherParty.email,
            firstName: otherParty.first_name,
            cancellerName: canceller.stage_name || canceller.first_name,
            reason: reason || 'Sans motif',
            eventDate: booking.event_date
          })
        }).catch(() => {});
      }

      return res.status(200).json({ success: true });
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Action invalide' });
};
