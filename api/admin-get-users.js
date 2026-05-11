const postgres = require('postgres');
const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { adminSecret, filter, status, type } = req.body;
  if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Non autorisé' });

  if (filter === 'reports') {
    const reports = type && type !== 'all'
      ? await sql`SELECT * FROM reports WHERE type = ${type} ORDER BY created_at DESC`
      : await sql`SELECT * FROM reports ORDER BY created_at DESC`;
    return res.status(200).json({ reports });
  }

  let users;
  if (filter === 'verif') {
    users = status === 'incomplete'
      ? await sql`SELECT * FROM users WHERE profile_complete = false ORDER BY created_at DESC`
      : await sql`SELECT * FROM users WHERE identity_status = ${status} ORDER BY created_at DESC`;
  } else {
    users = type === 'all'
      ? await sql`SELECT * FROM users ORDER BY created_at DESC`
      : await sql`SELECT * FROM users WHERE user_type = ${type} ORDER BY created_at DESC`;
  }

  return res.status(200).json({ users });
}
