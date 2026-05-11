const postgres = require('postgres');
const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = req.body;
  const { action, senderId } = body;

  if (action === 'get_conversations') {
    const { userId, userType } = body;
    const convs = userType === 'dj'
      ? await sql`SELECT * FROM conversations WHERE dj_id = ${userId} ORDER BY last_message_at DESC`
      : await sql`SELECT * FROM conversations WHERE venue_id = ${userId} ORDER BY last_message_at DESC`;
    return res.status(200).json({ conversations: convs });
  }

  if (action === 'get_messages') {
    const { conversationId } = body;
    const msgs = await sql`SELECT * FROM messages WHERE conversation_id = ${conversationId} ORDER BY created_at ASC`;
    await sql`UPDATE messages SET read = true WHERE conversation_id = ${conversationId} AND sender_id != ${senderId}`;
    return res.status(200).json({ messages: msgs });
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

  return res.status(400).json({ error: 'Action inconnue' });
}
