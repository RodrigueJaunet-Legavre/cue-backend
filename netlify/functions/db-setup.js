const { neon } = require('@neondatabase/serverless');

exports.handler = async () => {
  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  // Crée toutes les tables
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      password_hash TEXT,
      user_type TEXT,
      google_id TEXT,
      picture TEXT,
      identity_status TEXT DEFAULT 'pending',
      profile_complete BOOLEAN DEFAULT false,
      description TEXT,
      referral_code TEXT,
      plan TEXT DEFAULT 'starter',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      dj_id TEXT,
      venue_id TEXT,
      event_date DATE,
      amount DECIMAL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      amount DECIMAL,
      method TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT,
      reported_id TEXT,
      type TEXT,
      description TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS identity_documents (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      selfie_url TEXT,
      document_url TEXT,
      status TEXT DEFAULT 'pending',
      submitted_at TIMESTAMP DEFAULT NOW()
    )
  `;

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, message: 'Tables créées' })
  };
};
