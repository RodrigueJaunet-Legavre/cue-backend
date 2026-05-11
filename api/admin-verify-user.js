const postgres = require('postgres');
const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { adminSecret, userId, action } = req.body;
  if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Non autorisé' });

  const statusMap = {
    approve:     'verified',
    reject:      'rejected',
    request_new: 'incomplete',
    suspend:     'suspended'
  };

  const newStatus = statusMap[action];
  if (!newStatus) return res.status(400).json({ error: 'Action inconnue' });

  await sql`UPDATE users SET identity_status = ${newStatus} WHERE id = ${userId}`;
  return res.status(200).json({ success: true, action, userId });
}
