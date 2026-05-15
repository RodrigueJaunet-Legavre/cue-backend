const postgres = require('postgres');
const crypto = require('crypto');

const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + (process.env.SALT || 'cue_salt_2026')).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = req.body;
  if (!body) return res.status(400).json({ error: 'Body vide' });

  const { action } = body;
  console.log('Action reçue:', action);

  // INSCRIPTION
  if (action === 'register') {
    const { firstName, lastName, email, phone, password, userType, referralCode } = body;
    try {
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length) return res.status(400).json({ error: 'Cet email est déjà utilisé.' });

      const userId = Date.now().toString();
      const passwordHash = hashPassword(password);
      const ownReferralCode = 'REF' + firstName.charAt(0).toUpperCase() + lastName.charAt(0).toUpperCase() + Math.floor(1000 + Math.random() * 9000);

      await sql`
        INSERT INTO users (id, first_name, last_name, email, phone, password_hash, user_type, referral_code, referred_by)
        VALUES (${userId}, ${firstName}, ${lastName}, ${email}, ${phone || ''}, ${passwordHash}, ${userType}, ${ownReferralCode}, ${referralCode || null})
      `;

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sql`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (${Date.now().toString()}, ${userId}, ${token}, ${expiresAt})`;

      const [user] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      return res.status(200).json({ success: true, token, user: sanitizeUser(user) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // CONNEXION
  if (action === 'login') {
    const { email, password } = body;
    try {
      const passwordHash = hashPassword(password);
      const [user] = await sql`SELECT * FROM users WHERE email = ${email} AND password_hash = ${passwordHash}`;
      if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
      if (user.suspended) return res.status(403).json({ error: 'Compte suspendu. Contactez le support.' });

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sql`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (${Date.now().toString()}, ${user.id}, ${token}, ${expiresAt})`;
      return res.status(200).json({ success: true, token, user: sanitizeUser(user) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GOOGLE LOGIN
  if (action === 'google_login') {
    const { googleId, email, firstName, lastName, picture, userType, phone } = body;
    try {
      let [user] = await sql`SELECT * FROM users WHERE google_id = ${googleId} OR email = ${email}`;
      if (!user) {
        const userId = Date.now().toString();
        const ownReferralCode = 'REF' + firstName.charAt(0).toUpperCase() + lastName.charAt(0).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
        await sql`INSERT INTO users (id, first_name, last_name, email, phone, google_id, picture, user_type, referral_code) VALUES (${userId}, ${firstName}, ${lastName}, ${email}, ${phone || ''}, ${googleId}, ${picture || ''}, ${userType}, ${ownReferralCode})`;
        [user] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      } else if (!user.google_id) {
        await sql`UPDATE users SET google_id = ${googleId}, picture = ${picture || user.picture} WHERE id = ${user.id}`;
        [user] = await sql`SELECT * FROM users WHERE id = ${user.id}`;
      }
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sql`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (${Date.now().toString()}, ${user.id}, ${token}, ${expiresAt})`;
      return res.status(200).json({ success: true, token, user: sanitizeUser(user) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // VERIFY TOKEN
  if (action === 'verify_token') {
    const { token } = body;
    try {
      const [session] = await sql`SELECT s.*, u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ${token} AND s.expires_at > NOW()`;
      if (!session) return res.status(401).json({ error: 'Session expirée' });
      return res.status(200).json({ success: true, user: sanitizeUser(session) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // LOGOUT
  if (action === 'logout') {
    const { token } = body;
    await sql`DELETE FROM sessions WHERE token = ${token}`;
    return res.status(200).json({ success: true });
  }

  // UPDATE PROFILE (token-based)
  if (action === 'update_profile') {
    const { token } = body;
    try {
      const allSessions = await sql`SELECT * FROM sessions WHERE token = ${token}`;
      if (!allSessions.length) return res.status(401).json({ error: 'Session introuvable' });
      const session = allSessions[0];

      await sql`
        UPDATE users SET
          description = ${body.description || null},
          genres = ${body.genres || []},
          instagram = ${body.instagram || null},
          tiktok = ${body.tiktok || null},
          soundcloud = ${body.soundcloud || null},
          spotify = ${body.spotify || null},
          youtube = ${body.youtube || null},
          mix_url = ${body.mixUrl || null},
          tracks = ${body.tracks || []},
          profile_complete = true,
          updated_at = NOW()
        WHERE id = ${session.user_id}
      `;
      const [user] = await sql`SELECT * FROM users WHERE id = ${session.user_id}`;
      return res.status(200).json({ success: true, user: sanitizeUser(user) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE ACCOUNT
  if (action === 'delete_account') {
    const { userId } = body;
    try {
      console.log('Suppression compte userId:', userId);
      await sql`DELETE FROM messages WHERE sender_id = ${userId}`;
      await sql`DELETE FROM conversations WHERE dj_id = ${userId} OR venue_id = ${userId}`;
      await sql`DELETE FROM reviews WHERE dj_id = ${userId} OR venue_id = ${userId}`;
      await sql`DELETE FROM favorites WHERE venue_id = ${userId} OR dj_id = ${userId}`;
      await sql`DELETE FROM bookings WHERE dj_id = ${userId} OR venue_id = ${userId}`;
      await sql`DELETE FROM reports WHERE reporter_id = ${userId} OR reported_id = ${userId}`;
      await sql`DELETE FROM identity_documents WHERE user_id = ${userId}`;
      await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
      await sql`DELETE FROM users WHERE id = ${userId}`;
      console.log('✅ Compte supprimé:', userId);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.log('Erreur suppression:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'get_confirmed_bookings') {
    const { userId } = body;
    try {
      const bookings = await sql`SELECT * FROM bookings WHERE dj_id = ${userId} AND status = 'confirmed' ORDER BY created_at DESC`;
      return res.status(200).json({ bookings });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'change_password') {
    const { userId, newPassword } = body;
    try {
      const passwordHash = hashPassword(newPassword);
      await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'update_user_type') {
    const { userId, userType, phone } = body;
    try {
      await sql`UPDATE users SET user_type = ${userType}, phone = ${phone || ''} WHERE id = ${userId}`;
      const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
      return res.status(200).json({ success: true, user: sanitizeUser(users[0] || null) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'register_supabase') {
    const { userId, firstName, lastName, email, phone, userType, picture, googleId, referralCode } = body;
    try {
      await sql`
        INSERT INTO users (id, first_name, last_name, email, phone, user_type, picture, google_id, referral_code, profile_complete, identity_status, plan)
        VALUES (${userId}, ${firstName}, ${lastName || ''}, ${email}, ${phone || ''}, ${userType || 'pending'}, ${picture || null}, ${googleId || null}, ${referralCode}, false, 'none', 'starter')
        ON CONFLICT (id) DO NOTHING
      `;
      const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
      return res.status(200).json({ success: true, user: sanitizeUser(users[0] || null) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'update_profile_by_id') {
    const { userId, description, genres, instagram, tiktok, soundcloud, spotify, youtube, mixUrl, tracks, photo } = body;
    try {
      await sql`
        UPDATE users SET
          description = ${description || null},
          genres = ${genres || []},
          instagram = ${instagram || null},
          tiktok = ${tiktok || null},
          soundcloud = ${soundcloud || null},
          spotify = ${spotify || null},
          youtube = ${youtube || null},
          mix_url = ${mixUrl || null},
          tracks = ${tracks || []},
          picture = ${photo || null},
          profile_complete = true,
          updated_at = NOW()
        WHERE id = ${userId}
      `;
      const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
      const user = users[0] || null;
      console.log('✅ profile_complete:', user?.profile_complete);
      return res.status(200).json({ success: true, user: sanitizeUser(user) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'get_user') {
    const { userId, email } = body;
    try {
      let users = await sql`SELECT * FROM users WHERE id = ${userId}`;
      if (!users.length && email) {
        users = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (users.length) {
          await sql`UPDATE users SET id = ${userId} WHERE email = ${email}`;
          users = await sql`SELECT * FROM users WHERE id = ${userId}`;
          console.log('✅ ID migré vers UUID Supabase');
        }
      }
      return res.status(200).json({ user: sanitizeUser(users[0] || null) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'add_review') {
    const { djId, venueId, venueName, djName, rating, comment } = body;
    try {
      const existing = await sql`SELECT id FROM reviews WHERE dj_id = ${djId} AND venue_id = ${venueId}`;
      if (existing.length) {
        await sql`UPDATE reviews SET rating = ${rating}, comment = ${comment}, created_at = NOW() WHERE dj_id = ${djId} AND venue_id = ${venueId}`;
      } else {
        await sql`INSERT INTO reviews (id, dj_id, venue_id, venue_name, dj_name, rating, comment) VALUES (${Date.now().toString()}, ${djId}, ${venueId}, ${venueName || ''}, ${djName || ''}, ${rating}, ${comment})`;
      }
      const reviews = await sql`SELECT rating FROM reviews WHERE dj_id = ${djId}`;
      const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 0;
      return res.status(200).json({ success: true, avgRating: avg, totalReviews: reviews.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'get_reviews') {
    const { djId } = body;
    try {
      const reviews = await sql`SELECT * FROM reviews WHERE dj_id = ${djId} ORDER BY created_at DESC`;
      const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 0;
      return res.status(200).json({ reviews, avgRating: avg, totalReviews: reviews.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Action inconnue' });
}
