const postgres = require('postgres');
const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = req.body;
  const { action, senderId } = body;

  if (action === 'get_conversations') {
    const { userId, userType } = body;
    try {
      let convs;
      if (userType === 'dj') {
        convs = await sql`
          SELECT c.*, u.first_name as venue_first_name, u.last_name as venue_last_name, u.picture as venue_picture
          FROM conversations c
          LEFT JOIN users u ON c.venue_id = u.id
          WHERE c.dj_id = ${userId}
          ORDER BY c.last_message_at DESC NULLS LAST
        `;
        convs = convs.map(c => ({
          ...c,
          venue_name: c.venue_name || ((c.venue_first_name || '') + ' ' + (c.venue_last_name || '')).trim() || 'Venue'
        }));
      } else {
        convs = await sql`
          SELECT c.*, u.first_name as dj_first_name, u.last_name as dj_last_name, u.picture as dj_picture
          FROM conversations c
          LEFT JOIN users u ON c.dj_id = u.id
          WHERE c.venue_id = ${userId}
          ORDER BY c.last_message_at DESC NULLS LAST
        `;
        convs = convs.map(c => ({
          ...c,
          dj_name: c.dj_name || ((c.dj_first_name || '') + ' ' + (c.dj_last_name || '')).trim() || 'DJ'
        }));
      }
      return res.status(200).json({ conversations: convs });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'get_messages') {
    const { conversationId } = body;
    try {
      const messages = await sql`
        SELECT m.*, u.first_name as sender_first_name, u.last_name as sender_last_name
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ${conversationId}
        ORDER BY m.created_at ASC
      `;
      const enriched = messages.map(m => ({
        ...m,
        sender_name: m.sender_name || ((m.sender_first_name || '') + ' ' + (m.sender_last_name || '')).trim() || 'Utilisateur'
      }));
      await sql`UPDATE messages SET read = true WHERE conversation_id = ${conversationId} AND sender_id != ${senderId}`;
      return res.status(200).json({ messages: enriched });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'send_message') {
    const { convId, djId, venueId, djName, venueName, senderType, message } = body;
    const conv = await sql`SELECT * FROM conversations WHERE id = ${convId}`;
    if (!conv.length) {
      await sql`INSERT INTO conversations (id, dj_id, venue_id, dj_name, venue_name, last_message, last_message_at) VALUES (${convId}, ${djId}, ${venueId}, ${djName}, ${venueName}, ${message.content}, NOW())`;
    } else {
      await sql`UPDATE conversations SET last_message = ${message.content}, last_message_at = NOW() WHERE id = ${convId}`;
    }
    const msgId = Date.now().toString();
    await sql`INSERT INTO messages (id, conversation_id, sender_id, sender_name, sender_type, content, type, offer_data) VALUES (${msgId}, ${convId}, ${message.senderId}, ${message.senderName}, ${senderType}, ${message.content}, ${message.type || 'text'}, ${message.offerData ? JSON.stringify(message.offerData) : null})`;
    return res.status(200).json({ success: true, messageId: msgId });
  }

  if (action === 'update_offer') {
    const { messageId, status } = body;
    await sql`UPDATE messages SET offer_status = ${status} WHERE id = ${messageId}`;
    return res.status(200).json({ success: true });
  }

  if (action === 'unread_count') {
    const { userId } = body;
    const [count] = await sql`SELECT COUNT(*) FROM messages WHERE read = false AND sender_id != ${userId}`;
    return res.status(200).json({ count: count.count });
  }

  if (action === 'confirm_booking') {
    const { messageId, offerData, djId, venueId, djName, venueName } = body;
    const safeOffer = offerData || {};
    const safeDate = safeOffer.date || new Date().toISOString().split('T')[0];
    const safeStart = safeOffer.start || '';
    const safeEnd = safeOffer.end || '';
    const safeType = safeOffer.type || 'Soirée';
    const safeBudget = parseFloat(safeOffer.budget) || 0;
    const safeCity = safeOffer.city || '';
    const safeMessage = safeOffer.message || '';
    const safeDjId = djId || '';
    const safeVenueId = venueId || '';
    const safeDjName = djName || 'DJ';
    const safeVenueName = venueName || 'Venue';
    const bookingId = Date.now().toString();
    const convId = [safeDjId, safeVenueId].sort().join('_');

    try {
      await sql`UPDATE messages SET offer_status = 'confirmed' WHERE id = ${messageId}`;
      await sql`
        INSERT INTO bookings (
          id, dj_id, venue_id, dj_name, venue_name,
          event_date, start_time, end_time, event_type,
          amount, status, city, notes
        ) VALUES (
          ${bookingId},
          ${safeDjId}, ${safeVenueId}, ${safeDjName}, ${safeVenueName},
          ${safeDate}, ${safeStart}, ${safeEnd}, ${safeType},
          ${safeBudget}, 'confirmed', ${safeCity}, ${safeMessage}
        )
        ON CONFLICT DO NOTHING
      `;
      await sql`
        INSERT INTO messages (id, conversation_id, sender_id, sender_name, sender_type, content, type)
        VALUES (
          ${(Date.now() + 1).toString()}, ${convId},
          ${safeVenueId}, ${safeVenueName}, 'venue',
          ${'🎉 Booking confirmé ! Rendez-vous le ' + safeDate + (safeStart ? ' à ' + safeStart : '') + '. Le gig a été ajouté à votre agenda.'},
          'text'
        )
      `;
      // Crée le contrat automatiquement
      fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_from_booking', bookingId })
      }).catch(e => console.log('Erreur création contrat:', e.message));

      return res.status(200).json({
        success: true,
        booking: {
          id: bookingId, dj_id: safeDjId, venue_id: safeVenueId,
          dj_name: safeDjName, venue_name: safeVenueName,
          event_date: safeDate, start_time: safeStart, end_time: safeEnd,
          event_type: safeType, amount: safeBudget,
          city: safeCity, notes: safeMessage, status: 'confirmed'
        }
      });
    } catch (err) {
      console.log('Erreur confirm_booking:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'decline_booking') {
    const { messageId } = body;
    try {
      await sql`UPDATE messages SET offer_status = 'declined_by_venue' WHERE id = ${messageId}`;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'get_unread_count') {
    const { userId, userType } = body;
    try {
      const field = userType === 'dj' ? 'dj_id' : 'venue_id';
      const convs = await sql`SELECT id FROM conversations WHERE ${sql(field)} = ${userId}`;
      const convIds = convs.map(c => c.id);
      if (!convIds.length) return res.status(200).json({ unread: 0 });
      const unread = await sql`
        SELECT COUNT(*) as count FROM messages
        WHERE conversation_id = ANY(${convIds})
          AND sender_id != ${userId}
          AND (read IS NULL OR read = false)
      `;
      return res.status(200).json({ unread: parseInt(unread[0]?.count || 0) });
    } catch (err) {
      return res.status(200).json({ unread: 0 });
    }
  }

  return res.status(400).json({ error: 'Action inconnue' });
}
