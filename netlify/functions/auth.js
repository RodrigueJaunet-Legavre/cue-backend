const postgres = require('postgres');
const crypto = require('crypto');

const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + (process.env.SALT || 'cue_salt_2026')).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const { action } = body;

  // INSCRIPTION
  if (action === 'register') {
    const { firstName, lastName, email, phone, password, userType, referralCode } = body;
    try {
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Cet email est déjà utilisé.' }) };
      }

      const userId = Date.now().toString();
      const passwordHash = hashPassword(password);
      const ownReferralCode = 'REF' + firstName.charAt(0).toUpperCase() + lastName.charAt(0).toUpperCase() + Math.floor(1000 + Math.random() * 9000);

      await sql`
        INSERT INTO users (id, first_name, last_name, email, phone, password_hash, user_type, referral_code, referred_by)
        VALUES (${userId}, ${firstName}, ${lastName}, ${email}, ${phone || ''}, ${passwordHash}, ${userType}, ${ownReferralCode}, ${referralCode || null})
      `;

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sql`
        INSERT INTO sessions (id, user_id, token, expires_at)
        VALUES (${Date.now().toString()}, ${userId}, ${token}, ${expiresAt})
      `;

      const [user] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      return { statusCode: 200, body: JSON.stringify({ success: true, token, user: sanitizeUser(user) }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  // CONNEXION
  if (action === 'login') {
    const { email, password } = body;
    try {
      const passwordHash = hashPassword(password);
      const [user] = await sql`SELECT * FROM users WHERE email = ${email} AND password_hash = ${passwordHash}`;

      if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Email ou mot de passe incorrect.' }) };
      }

      if (user.suspended) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Compte suspendu. Contactez le support.' }) };
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sql`
        INSERT INTO sessions (id, user_id, token, expires_at)
        VALUES (${Date.now().toString()}, ${user.id}, ${token}, ${expiresAt})
      `;

      return { statusCode: 200, body: JSON.stringify({ success: true, token, user: sanitizeUser(user) }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  // GOOGLE LOGIN
  if (action === 'google_login') {
    const { googleId, email, firstName, lastName, picture, userType, phone } = body;
    try {
      let [user] = await sql`SELECT * FROM users WHERE google_id = ${googleId} OR email = ${email}`;

      if (!user) {
        // Nouvel utilisateur → créer
        const userId = Date.now().toString();
        const ownReferralCode = 'REF' + firstName.charAt(0).toUpperCase() + lastName.charAt(0).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
        await sql`
          INSERT INTO users (id, first_name, last_name, email, phone, google_id, picture, user_type, referral_code)
          VALUES (${userId}, ${firstName}, ${lastName}, ${email}, ${phone || ''}, ${googleId}, ${picture || ''}, ${userType}, ${ownReferralCode})
        `;
        [user] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      } else if (!user.google_id) {
        // Compte existant sans Google ID → lier le compte Google
        await sql`UPDATE users SET google_id = ${googleId}, picture = ${picture || user.picture} WHERE id = ${user.id}`;
        [user] = await sql`SELECT * FROM users WHERE id = ${user.id}`;
      }

      // Si user existant avec profile_complete → créer juste une session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sql`
        INSERT INTO sessions (id, user_id, token, expires_at)
        VALUES (${Date.now().toString()}, ${user.id}, ${token}, ${expiresAt})
      `;

      return { statusCode: 200, body: JSON.stringify({ success: true, token, user: sanitizeUser(user) }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  // VERIFY TOKEN
  if (action === 'verify_token') {
    const { token } = body;
    try {
      const [session] = await sql`
        SELECT s.*, u.* FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ${token} AND s.expires_at > NOW()
      `;

      if (!session) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Session expirée' }) };
      }

      return { statusCode: 200, body: JSON.stringify({ success: true, user: sanitizeUser(session) }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  // LOGOUT
  if (action === 'logout') {
    const { token } = body;
    await sql`DELETE FROM sessions WHERE token = ${token}`;
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  // UPDATE PROFILE
  if (action === 'update_profile') {
    console.log('=== UPDATE PROFILE APPELÉ ===');
    const { token } = body;
    console.log('Token reçu:', token ? token.substring(0, 20) + '...' : 'AUCUN');

    try {
      // Cherche la session SANS filtre expires_at pour déboguer
      const allSessions = await sql`SELECT * FROM sessions WHERE token = ${token}`;
      console.log('Sessions trouvées:', allSessions.length);

      if (!allSessions.length) {
        console.log('ERREUR: Token introuvable en DB');
        return { statusCode: 401, body: JSON.stringify({ error: 'Session introuvable' }) };
      }

      const session = allSessions[0];
      console.log('Session expirée?', new Date(session.expires_at) < new Date());
      console.log('User ID:', session.user_id);

      // Update même si session expirée (onboarding)
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
      console.log('profile_complete après update:', user.profile_complete);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, user: sanitizeUser(user) })
      };
    } catch (err) {
      console.log('Erreur update_profile:', err.message);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  // DELETE ACCOUNT
  if (action === 'delete_account') {
    const { token } = body;
    try {
      const [session] = await sql`SELECT user_id FROM sessions WHERE token = ${token}`;
      if (!session) return { statusCode: 401, body: JSON.stringify({ error: 'Non autorisé' }) };

      await sql`DELETE FROM sessions WHERE user_id = ${session.user_id}`;
      await sql`DELETE FROM users WHERE id = ${session.user_id}`;

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (action === 'update_user_type') {
    console.log('=== UPDATE_USER_TYPE ===')
    const { userId, userType, phone } = body;
    try {
      await sql`
        UPDATE users SET
          user_type = ${userType},
          phone = ${phone || ''}
        WHERE id = ${userId}
      `;
      const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
      const user = users[0] || null;
      console.log('User trouvé après update:', !!user);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, user: sanitizeUser(user) })
      };
    } catch (err) {
      console.log('ERREUR:', err.message);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (action === 'register_supabase') {
    const { userId, firstName, lastName, email, phone, userType, picture, googleId, referralCode } = body;
    try {
      await sql`
        INSERT INTO users (id, first_name, last_name, email, phone, user_type, picture, google_id, referral_code, profile_complete, identity_status, plan)
        VALUES (${userId}, ${firstName}, ${lastName || ''}, ${email}, ${phone || ''}, ${userType || null}, ${picture || null}, ${googleId || null}, ${referralCode}, false, 'none', 'starter')
        ON CONFLICT (id) DO NOTHING
      `;
      const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
      const user = users[0] || null;
      return { statusCode: 200, body: JSON.stringify({ success: true, user: sanitizeUser(user) }) };
    } catch (err) {
      console.log('ERREUR register_supabase:', err.message);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
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
      return { statusCode: 200, body: JSON.stringify({ success: true, user: sanitizeUser(user) }) };
    } catch (err) {
      console.log('❌ Erreur:', err.message);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (action === 'get_user') {
    const { userId } = body;
    try {
      const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
      const user = users[0] || null;
      return { statusCode: 200, body: JSON.stringify({ user: sanitizeUser(user) }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 400, body: JSON.stringify({ error: 'Action inconnue' }) };
};

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}
