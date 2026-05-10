const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  const sql = neon(process.env.NETLIFY_DATABASE_URL);
  const body = JSON.parse(event.body);
  const { action, senderId, receiverId, content, conversationId, offerId } = body;

  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      dj_id TEXT,
      venue_id TEXT,
      dj_name TEXT,
      venue_name TEXT,
      last_message TEXT,
      last_message_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      sender_id TEXT,
      sender_name TEXT,
      sender_type TEXT,
      content TEXT,
      type TEXT DEFAULT 'text',
      offer_data JSONB,
      offer_status TEXT,
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  if (action === 'get_conversations') {
    const { userId, userType } = body;
    let convs;
    if (userType === 'dj') {
      convs = await sql`SELECT * FROM conversations WHERE dj_id = ${userId} ORDER BY last_message_at DESC`;
    } else {
      convs = await sql`SELECT * FROM conversations WHERE venue_id = ${userId} ORDER BY last_message_at DESC`;
    }
    return { statusCode: 200, body: JSON.stringify({ conversations: convs }) };
  }

  if (action === 'get_messages') {
    const { conversationId: convId } = body;
    const msgs = await sql`SELECT * FROM messages WHERE conversation_id = ${convId} ORDER BY created_at ASC`;
    await sql`UPDATE messages SET read = true WHERE conversation_id = ${convId} AND sender_id != ${senderId}`;
    return { statusCode: 200, body: JSON.stringify({ messages: msgs }) };
  }

  if (action === 'send_message') {
    const { convId, djId, venueId, djName, venueName, senderType, message } = body;

    const conv = await sql`SELECT * FROM conversations WHERE id = ${convId}`;
    if (!conv.length) {
      await sql`
        INSERT INTO conversations (id, dj_id, venue_id, dj_name, venue_name, last_message, last_message_at)
        VALUES (${convId}, ${djId}, ${venueId}, ${djName}, ${venueName}, ${message.content}, NOW())
      `;
    } else {
      await sql`UPDATE conversations SET last_message = ${message.content}, last_message_at = NOW() WHERE id = ${convId}`;
    }

    const msgId = Date.now().toString();
    await sql`
      INSERT INTO messages (id, conversation_id, sender_id, sender_name, sender_type, content, type, offer_data)
      VALUES (${msgId}, ${convId}, ${message.senderId}, ${message.senderName}, ${senderType}, ${message.content}, ${message.type || 'text'}, ${message.offerData ? JSON.stringify(message.offerData) : null})
    `;

    return { statusCode: 200, body: JSON.stringify({ success: true, messageId: msgId }) };
  }

  if (action === 'update_offer') {
    const { messageId, status } = body;
    await sql`UPDATE messages SET offer_status = ${status} WHERE id = ${messageId}`;
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  if (action === 'unread_count') {
    const { userId } = body;
    const [count] = await sql`SELECT COUNT(*) FROM messages WHERE read = false AND sender_id != ${userId}`;
    return { statusCode: 200, body: JSON.stringify({ count: count.count }) };
  }

  return { statusCode: 400, body: 'Action inconnue' };
};
