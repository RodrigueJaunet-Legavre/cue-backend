const postgres = require('postgres');
const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { userId, selfieBase64, documentBase64, selfieType, documentType } = req.body;

    const selfieExt = selfieType?.includes('png') ? 'png' : 'jpg';
    const docExt = documentType?.includes('png') ? 'png' : 'jpg';

    const selfieBuffer = Buffer.from(selfieBase64, 'base64');
    const docBuffer = Buffer.from(documentBase64, 'base64');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    const selfieRes = await fetch(`${supabaseUrl}/storage/v1/object/identity-docs/${userId}/selfie.${selfieExt}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': selfieType || 'image/jpeg', 'x-upsert': 'true' },
      body: selfieBuffer
    });

    const docRes = await fetch(`${supabaseUrl}/storage/v1/object/identity-docs/${userId}/document.${docExt}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': documentType || 'image/jpeg', 'x-upsert': 'true' },
      body: docBuffer
    });

    if (!selfieRes.ok || !docRes.ok) throw new Error('Erreur upload Supabase Storage');

    const selfieUrl = `${supabaseUrl}/storage/v1/object/identity-docs/${userId}/selfie.${selfieExt}`;
    const docUrl = `${supabaseUrl}/storage/v1/object/identity-docs/${userId}/document.${docExt}`;

    await sql`
      INSERT INTO identity_documents (id, user_id, selfie_url, document_url, status, submitted_at)
      VALUES (${Date.now().toString()}, ${userId}, ${selfieUrl}, ${docUrl}, 'pending', NOW())
      ON CONFLICT (user_id) DO UPDATE SET selfie_url = ${selfieUrl}, document_url = ${docUrl}, status = 'pending', submitted_at = NOW()
    `;
    await sql`UPDATE users SET identity_status = 'pending' WHERE id = ${userId}`;

    return res.status(200).json({ success: true, selfieUrl, docUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: { sizeLimit: '20mb' } } };
