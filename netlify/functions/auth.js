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
    const { token, description, genres, instagram, soundcloud, spotify, youtube, mixUrl, tracks } = body;
    try {
      const [session] = await sql`SELECT user_id FROM sessions WHERE token = ${token} AND expires_at > NOW()`;
      if (!session) return { statusCode: 401, body: JSON.stringify({ error: 'Non autorisé' }) };

      await sql`
        UPDATE users SET
          description = ${description || null},
          genres = ${genres || []},
          instagram = ${instagram || null},
          soundcloud = ${soundcloud || null},
          spotify = ${spotify || null},
          youtube = ${youtube || null},
          mix_url = ${mixUrl || null},
          tracks = ${tracks || []},
          profile_complete = true,
          updated_at = NOW()
        WHERE id = ${session.user_id}
      `;

      const [user] = await sql`SELECT * FROM users WHERE id = ${session.user_id}`;
      return { statusCode: 200, body: JSON.stringify({ success: true, user: sanitizeUser(user) }) };
    } catch (err) {
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

  return { statusCode: 400, body: JSON.stringify({ error: 'Action inconnue' }) };
};

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}
