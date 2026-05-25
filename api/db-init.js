const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

module.exports = async function handler(req, res) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT,
      user_type TEXT DEFAULT 'pending',
      google_id TEXT,
      picture TEXT,
      plan TEXT DEFAULT 'starter',
      identity_status TEXT DEFAULT 'none',
      identity_motif TEXT,
      identity_docs_required TEXT,
      profile_complete BOOLEAN DEFAULT false,
      description TEXT,
      genres TEXT[],
      instagram TEXT,
      tiktok TEXT,
      soundcloud TEXT,
      spotify TEXT,
      youtube TEXT,
      mix_url TEXT,
      tracks TEXT[],
      referral_code TEXT,
      referred_by TEXT,
      referral_balance DECIMAL DEFAULT 0,
      suspended BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      dj_id TEXT REFERENCES users(id),
      venue_id TEXT REFERENCES users(id),
      dj_name TEXT, venue_name TEXT,
      event_date DATE, start_time TEXT, end_time TEXT, event_type TEXT,
      amount DECIMAL, status TEXT DEFAULT 'pending', notes TEXT,
      source TEXT DEFAULT 'cue', created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      dj_id TEXT REFERENCES users(id),
      venue_id TEXT REFERENCES users(id),
      booking_id TEXT, dj_name TEXT, venue_name TEXT,
      rating INTEGER NOT NULL, comment TEXT, created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      venue_id TEXT REFERENCES users(id),
      dj_id TEXT, created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(venue_id, dj_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, dj_id TEXT, venue_id TEXT,
      dj_name TEXT, venue_name TEXT, last_message TEXT,
      last_message_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, conversation_id TEXT,
      sender_id TEXT, sender_name TEXT, sender_type TEXT,
      content TEXT, type TEXT DEFAULT 'text',
      offer_data JSONB, offer_status TEXT,
      read BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, reporter_id TEXT, reported_id TEXT,
      type TEXT, description TEXT, status TEXT DEFAULT 'open', created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS identity_documents (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE REFERENCES users(id),
      selfie_url TEXT, document_url TEXT,
      status TEXT DEFAULT 'pending', submitted_at TIMESTAMP DEFAULT NOW()
    )
  `;

  return res.status(200).json({ success: true, message: '✅ Toutes les tables créées' });
}
