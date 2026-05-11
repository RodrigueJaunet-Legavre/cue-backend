const postgres = require('postgres');

exports.handler = async (event) => {
  const { adminSecret, filter, status, type } = JSON.parse(event.body);

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, body: 'Non autorisé' };
  }

  const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

  if (filter === 'reports') {
    let reports;
    if (type === 'all' || !type) {
      reports = await sql`SELECT * FROM reports ORDER BY created_at DESC`;
    } else {
      reports = await sql`SELECT * FROM reports WHERE type = ${type} ORDER BY created_at DESC`;
    }
    return { statusCode: 200, body: JSON.stringify({ reports }) };
  }

  let users;

  if (filter === 'verif') {
    if (status === 'incomplete') {
      users = await sql`SELECT * FROM users WHERE profile_complete = false ORDER BY created_at DESC`;
    } else {
      users = await sql`SELECT * FROM users WHERE identity_status = ${status} ORDER BY created_at DESC`;
    }
  } else {
    if (type === 'all') {
      users = await sql`SELECT * FROM users ORDER BY created_at DESC`;
    } else {
      users = await sql`SELECT * FROM users WHERE user_type = ${type} ORDER BY created_at DESC`;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ users })
  };
};
