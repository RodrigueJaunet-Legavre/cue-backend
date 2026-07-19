CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  booking_id TEXT,
  dj_id TEXT,
  venue_id TEXT,
  amount NUMERIC,
  commission NUMERIC,
  dj_amount NUMERIC,
  status TEXT DEFAULT 'held',
  type TEXT DEFAULT 'payment',
  created_at TIMESTAMP DEFAULT NOW(),
  released_at TIMESTAMP
);
