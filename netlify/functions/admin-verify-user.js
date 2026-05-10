const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  const { adminSecret, userId, action } = JSON.parse(event.body);

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, body: 'Non autorisé' };
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  const statusMap = {
    approve:     { identity_status: 'verified' },
    reject:      { identity_status: 'rejected' },
    request_new: { identity_status: 'incomplete' },
    suspend:     { identity_status: 'suspended' }
  };

  const update = statusMap[action];
  if (!update) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Action inconnue' }) };
  }

  await sql`
    UPDATE users
    SET identity_status = ${update.identity_status}
    WHERE id = ${userId}
  `;

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, action, userId })
  };
};
