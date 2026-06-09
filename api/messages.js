const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = req.body;
  const { action, senderId } = body;

  if (action === 'get_conversations') {
    const { userId, userType } = body;
    if (!userId || userId === 'undefined') {
      return res.status(400).json({ error: 'userId requis', conversations: [] });
    }
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
    const { djId, venueId, djName, venueName, senderType, message, contractLink, contractId } = body;
    // accept both convId and conversationId
    const convId = body.convId || body.conversationId;
    // accept both nested message object and flat format
    const senderId2  = message?.senderId  || body.senderId;
    const senderName = message?.senderName || body.senderName || '';
    const content    = message?.content   || body.content || '';
    const msgType    = message?.type      || body.type || 'text';
    const offerData  = message?.offerData || null;

    const conv = await sql`SELECT * FROM conversations WHERE id = ${convId}`;
    const preview = msgType === 'contract_proposal' ? '📄 Proposition de contrat' : content;
    if (!conv.length) {
      await sql`INSERT INTO conversations (id, dj_id, venue_id, dj_name, venue_name, last_message, last_message_at) VALUES (${convId}, ${djId||''}, ${venueId||''}, ${djName||''}, ${venueName||''}, ${preview}, NOW())`;
    } else {
      await sql`UPDATE conversations SET last_message = ${preview}, last_message_at = NOW() WHERE id = ${convId}`;
    }
    const msgId = Date.now().toString();
    await sql`INSERT INTO messages (id, conversation_id, sender_id, sender_name, sender_type, content, type, offer_data, contract_link)
      VALUES (${msgId}, ${convId}, ${senderId2}, ${senderName}, ${senderType||'dj'}, ${content}, ${msgType}, ${offerData ? JSON.stringify(offerData) : null}, ${contractLink || null})`;
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
      // Récupère les emails pour le contrat
      const [djUser]    = await sql`SELECT email FROM users WHERE id = ${safeDjId}`;
      const [venueUser] = await sql`SELECT email FROM users WHERE id = ${safeVenueId}`;
      const djEmail     = djUser?.email || '';
      const venueEmail  = venueUser?.email || '';

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

      // Crée le contrat directement en DB
      const contractId = 'CTR-' + Date.now();
      try {
        await sql`
          INSERT INTO contracts (
            id, booking_id, dj_id, venue_id,
            event_date, event_type, amount,
            dj_name, venue_name,
            dj_email, venue_email,
            status
          ) VALUES (
            ${contractId}, ${bookingId},
            ${safeDjId}, ${safeVenueId},
            ${safeDate}, ${safeType}, ${safeBudget},
            ${safeDjName}, ${safeVenueName},
            ${djEmail}, ${venueEmail},
            'draft'
          )
        `;
        console.log('✅ Contrat créé:', contractId);
      } catch(err) {
        console.log('Erreur création contrat:', err.message);
      }

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

  if (action === 'respond_to_contract') {
    const { messageId, status } = body;
    try {
      await sql`UPDATE messages SET contract_status = ${status} WHERE id = ${messageId}`;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'send_offer') {
    const { djId, venueId, date, start, end, budget, type, message } = body
    try {
      // Récupère les noms pour la conversation
      const [dj] = await sql`SELECT stage_name, first_name, last_name FROM users WHERE id = ${djId}`
      const [venue] = await sql`SELECT first_name, last_name, org_name FROM users WHERE id = ${venueId}`
      const djName = dj?.stage_name || ((dj?.first_name || '') + ' ' + (dj?.last_name || '')).trim() || 'DJ'
      const venueName = venue?.org_name || ((venue?.first_name || '') + ' ' + (venue?.last_name || '')).trim() || 'Venue'

      // Vérifie si une conversation existe déjà
      let [conv] = await sql`
        SELECT * FROM conversations WHERE dj_id = ${djId} AND venue_id = ${venueId} LIMIT 1
      `

      const offerText = JSON.stringify({
        date: date || '',
        start: start || '',
        end: end || '',
        budget: budget || '',
        type: type || '',
        message: message || ''
      })

      // Crée la conversation si elle n'existe pas
      if (!conv) {
        const convId = Date.now().toString()
        await sql`
          INSERT INTO conversations (id, dj_id, venue_id, dj_name, venue_name, last_message, last_message_at)
          VALUES (${convId}, ${djId}, ${venueId}, ${djName}, ${venueName}, ${offerText}, NOW())
        `
        conv = { id: convId }
      } else {
        await sql`
          UPDATE conversations SET last_message = ${offerText}, last_message_at = NOW() WHERE id = ${conv.id}
        `
      }

      // Insère le message d'offre
      const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 4)
      await sql`
        INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at)
        VALUES (${msgId}, ${conv.id}, ${venueId}, ${offerText}, 'offer', NOW())
      `

      return res.status(200).json({ success: true, conversationId: conv.id })
    } catch(err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (action === 'get_bookings') {
    const { userId, userType } = body;
    try {
      let bookings;
      if (userType === 'dj') {
        bookings = await sql`
          SELECT b.*, u.first_name as venue_name, u.org_name
          FROM bookings b
          LEFT JOIN users u ON u.id = b.venue_id
          WHERE b.dj_id = ${userId}
          ORDER BY b.created_at DESC
        `;
      } else {
        bookings = await sql`
          SELECT b.*, u.first_name as dj_first, u.last_name as dj_last, u.stage_name
          FROM bookings b
          LEFT JOIN users u ON u.id = b.dj_id
          WHERE b.venue_id = ${userId}
          ORDER BY b.created_at DESC
        `;
      }
      return res.status(200).json({ bookings });
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Action inconnue' });
}
