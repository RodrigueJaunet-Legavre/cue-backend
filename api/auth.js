const postgres = require('postgres');
const crypto = require('crypto');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

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
    const { firstName, lastName, email, phone, password, userType, referralCode, picture, venuePhotos, venueType, orgName, orgSiret } = body;
    try {
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length) return res.status(400).json({ error: 'Cet email est déjà utilisé.' });

      const userId = crypto.randomUUID();
      const passwordHash = hashPassword(password);
      const ownReferralCode = 'REF' + firstName.charAt(0).toUpperCase() + lastName.charAt(0).toUpperCase() + Math.floor(1000 + Math.random() * 9000);

      await sql`
        INSERT INTO users (
          id, first_name, last_name, email, phone, password_hash,
          user_type, referral_code, referred_by, picture,
          venue_photos, venue_type, org_name, org_siret
        ) VALUES (
          ${userId}, ${firstName}, ${lastName}, ${email}, ${phone || ''}, ${passwordHash},
          ${userType}, ${ownReferralCode}, ${referralCode || null}, ${picture || null},
          ${venuePhotos || []}, ${venueType || null}, ${orgName || null}, ${orgSiret || null}
        )
      `;

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sql`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (${crypto.randomUUID()}, ${userId}, ${token}, ${expiresAt})`;

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
      await sql`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (${crypto.randomUUID()}, ${user.id}, ${token}, ${expiresAt})`;
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
        const userId = crypto.randomUUID();
        const ownReferralCode = 'REF' + firstName.charAt(0).toUpperCase() + lastName.charAt(0).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
        await sql`INSERT INTO users (id, first_name, last_name, email, phone, google_id, picture, user_type, referral_code) VALUES (${userId}, ${firstName}, ${lastName}, ${email}, ${phone || ''}, ${googleId}, ${picture || ''}, ${userType}, ${ownReferralCode})`;
        [user] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      } else if (!user.google_id) {
        await sql`UPDATE users SET google_id = ${googleId}, picture = ${picture || user.picture} WHERE id = ${user.id}`;
        [user] = await sql`SELECT * FROM users WHERE id = ${user.id}`;
      }
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sql`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (${crypto.randomUUID()}, ${user.id}, ${token}, ${expiresAt})`;
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
      await sql`DELETE FROM contracts WHERE dj_id = ${userId} OR venue_id = ${userId}`;
      await sql`DELETE FROM users WHERE id = ${userId}`;

      // Supprime aussi dans Supabase Auth avec la service key
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authError) console.log('Erreur suppression Supabase Auth:', authError.message);

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
    const { userId, userType, venueType, phone } = body;
    try {
      await sql`
        UPDATE users SET
          user_type = ${userType},
          venue_type = ${venueType || null},
          phone = ${phone || ''}
        WHERE id = ${userId}
      `;
      const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
      return res.status(200).json({ success: true, user: sanitizeUser(users[0] || null) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'register_supabase') {
    const { userId, firstName, lastName, email, phone, userType, picture, googleId, referralCode, venuePhotos, venueType, orgName, orgSiret } = body;
    try {
      await sql`
        INSERT INTO users (
          id, first_name, last_name, email, phone, user_type,
          picture, google_id, referral_code, profile_complete,
          identity_status, plan, venue_photos, venue_type,
          org_name, org_siret
        ) VALUES (
          ${userId}, ${firstName}, ${lastName || ''}, ${email},
          ${phone || ''}, ${userType || 'pending'}, ${picture || null},
          ${googleId || null}, ${referralCode}, false, 'none', 'starter',
          ${venuePhotos || []}, ${venueType || null},
          ${orgName || null}, ${orgSiret || null}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
      return res.status(200).json({ success: true, user: sanitizeUser(users[0] || null) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'update_name') {
    const { userId, firstName, lastName } = body
    try {
      await sql`
        UPDATE users SET
          first_name = ${firstName || null},
          last_name = ${lastName || null},
          updated_at = NOW()
        WHERE id = ${userId}
      `
      return res.status(200).json({ success: true })
    } catch(err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (action === 'update_genres') {
    const { userId, genres } = body
    try {
      const genresArray = Array.isArray(genres) ? genres : []
      await sql`
        UPDATE users SET
          genres = ${sql.array(genresArray)},
          updated_at = NOW()
        WHERE id = ${userId}
      `
      return res.status(200).json({ success: true })
    } catch(err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (action === 'update_profile_by_id') {
    const { userId, description, genres, instagram, tiktok, soundcloud,
            spotify, youtube, mixUrl, tracks, photo } = body;
    try {
      // Parse genres — accepte string JSON ou array
      let genresArray = [];
      if (genres) {
        genresArray = Array.isArray(genres) ? genres : JSON.parse(genres);
      }

      // Parse tracks — accepte string JSON ou array
      let tracksArray = [];
      if (tracks) {
        tracksArray = Array.isArray(tracks) ? tracks : JSON.parse(tracks);
      }

      await sql`
        UPDATE users SET
          description = ${description || null},
          genres = ${sql.array(genresArray)},
          instagram = ${instagram || null},
          tiktok = ${tiktok || null},
          soundcloud = ${soundcloud || null},
          spotify = ${spotify || null},
          youtube = ${youtube || null},
          mix_url = ${mixUrl || null},
          tracks = ${sql.array(tracksArray)},
          picture = ${photo || null},
          profile_complete = true,
          updated_at = NOW()
        WHERE id = ${userId}
      `;
      const [user] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      console.log('✅ profile_complete:', user?.profile_complete);
      return res.status(200).json({ success: true, user: sanitizeUser(user) });
    } catch(err) {
      console.log('❌ update_profile_by_id error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'save_presskit') {
    const { userId, bioShort, bioLong, years, gigs, countries } = body;
    try {
      await sql`
        UPDATE users SET
          pk_bio_short = ${bioShort || null},
          pk_bio_long  = ${bioLong  || null},
          pk_years     = ${years     ? parseInt(years)     : null},
          pk_gigs      = ${gigs      ? parseInt(gigs)      : null},
          pk_countries = ${countries ? parseInt(countries) : null},
          updated_at   = NOW()
        WHERE id = ${userId}
      `;
      return res.status(200).json({ success: true });
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'get_user') {
    const { userId, email } = body;

    if (!userId && !email) {
      return res.status(400).json({ error: 'userId ou email requis' });
    }

    try {
      let users = [];

      if (userId && userId !== 'undefined' && userId !== 'null') {
        users = await sql`SELECT * FROM users WHERE id = ${userId}`;
      }

      if (!users.length && email && email !== 'undefined') {
        users = await sql`SELECT * FROM users WHERE email = ${email}`;
      }

      const user = users[0] || null;

      if (user && userId && user.id !== userId) {
        console.log('IDs différents - user.id:', user.id, 'userId:', userId);
      }

      return res.status(200).json({ user: sanitizeUser(user) });
    } catch (err) {
      console.log('Erreur get_user:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'update_plan') {
    const { userId, plan } = body;
    try {
      await sql`UPDATE users SET plan = ${plan} WHERE id = ${userId}`;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'save_iban') {
    const { userId, iban, bic, bankName } = body;
    try {
      await sql`UPDATE users SET iban = ${iban}, bic = ${bic || null}, bank_name = ${bankName || null} WHERE id = ${userId}`;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'mark_verif_notif_shown') {
    const { userId } = body;
    try {
      await sql`UPDATE users SET verif_notif_shown = true WHERE id = ${userId}`;
      return res.status(200).json({ success: true });
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
      const reviews = await sql`
        SELECT r.*, u.first_name as venue_first_name, u.last_name as venue_last_name, u.picture as venue_picture
        FROM reviews r
        LEFT JOIN users u ON r.venue_id = u.id
        WHERE r.dj_id = ${djId}
        ORDER BY r.created_at DESC
      `;
      const enriched = reviews.map(r => ({
        ...r,
        venue_name: r.venue_name || ((r.venue_first_name || '') + ' ' + (r.venue_last_name || '')).trim() || 'Venue'
      }));
      const total = enriched.length;
      const avg = total > 0 ? (enriched.reduce((s, r) => s + parseFloat(r.rating || 0), 0) / total).toFixed(1) : '0';
      return res.status(200).json({ reviews: enriched, avgRating: parseFloat(avg), totalReviews: total });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'get_venue_reviews') {
    const { venueId } = body;
    try {
      const reviews = await sql`
        SELECT r.*, u.first_name as dj_first_name, u.last_name as dj_last_name, u.picture as dj_picture
        FROM reviews r
        LEFT JOIN users u ON r.dj_id = u.id
        WHERE r.venue_id = ${venueId}
        ORDER BY r.created_at DESC
      `;
      const enriched = reviews.map(r => ({
        ...r,
        dj_name: r.dj_name || ((r.dj_first_name || '') + ' ' + (r.dj_last_name || '')).trim() || 'DJ'
      }));
      const total = enriched.length;
      const avg = total > 0 ? (enriched.reduce((s, r) => s + parseFloat(r.rating || 0), 0) / total).toFixed(1) : '0';
      return res.status(200).json({ reviews: enriched, avgRating: parseFloat(avg), totalReviews: total });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'get_venue_bookings') {
    const { venueId } = body;
    try {
      const bookings = await sql`SELECT * FROM bookings WHERE venue_id = ${venueId} AND status = 'confirmed' ORDER BY event_date ASC`;
      return res.status(200).json({ bookings });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'get_favorites') {
    const { venueId } = body;
    try {
      const favs = await sql`SELECT f.dj_id FROM favorites f WHERE f.venue_id = ${venueId}`;
      return res.status(200).json({ favorites: favs.map(f => f.dj_id) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'toggle_favorite') {
    const { venueId, djId } = body;
    try {
      const existing = await sql`SELECT id FROM favorites WHERE venue_id = ${venueId} AND dj_id = ${djId}`;
      if (existing.length) {
        await sql`DELETE FROM favorites WHERE venue_id = ${venueId} AND dj_id = ${djId}`;
        return res.status(200).json({ added: false });
      } else {
        await sql`INSERT INTO favorites (id, venue_id, dj_id) VALUES (${Date.now().toString()}, ${venueId}, ${djId})`;
        return res.status(200).json({ added: true });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'update_venue_profile') {
    const { userId, picture, description, city, website, orgName, orgSiret, venuePhotos } = body;
    try {
      await sql`
        UPDATE users SET
          picture = ${picture || null},
          description = ${description || null},
          venue_city = ${city || null},
          venue_website = ${website || null},
          org_name = ${orgName || null},
          org_siret = ${orgSiret || null},
          venue_photos = ${venuePhotos || []},
          updated_at = NOW()
        WHERE id = ${userId}
      `;
      const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
      return res.status(200).json({ success: true, user: sanitizeUser(users[0] || null) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'complete_venue_onboarding') {
    const { userId, orgName, orgSiret, docUrl } = body;
    const newStatus = docUrl ? 'pending' : 'none';
    try {
      await sql`
        UPDATE users SET
          profile_complete = true,
          identity_status = ${newStatus},
          org_name = ${orgName || null},
          org_siret = ${orgSiret || null},
          updated_at = NOW()
        WHERE id = ${userId}
      `;
      if (docUrl) {
        await sql`
          INSERT INTO identity_documents (id, user_id, document_url, status, submitted_at)
          VALUES (${crypto.randomUUID()}, ${userId}, ${docUrl}, 'pending', NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            document_url = ${docUrl},
            status = 'pending',
            submitted_at = NOW()
        `;
      }
      const [user] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      return res.status(200).json({ success: true, user: sanitizeUser(user) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'check_favorite') {
    const { venueId, djId } = body;
    try {
      const existing = await sql`SELECT id FROM favorites WHERE venue_id = ${venueId} AND dj_id = ${djId}`;
      return res.status(200).json({ isFavorite: existing.length > 0 });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'submit_org_verification') {
    const { userId, orgName, orgSiret, docUrl } = body;
    try {
      await sql`
        UPDATE users SET
          org_name = ${orgName},
          org_siret = ${orgSiret},
          identity_status = 'pending',
          updated_at = NOW()
        WHERE id = ${userId}
      `;
      if (docUrl) {
        await sql`
          INSERT INTO identity_documents (id, user_id, document_url, status, submitted_at)
          VALUES (${crypto.randomUUID()}, ${userId}, ${docUrl}, 'pending', NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            document_url = ${docUrl},
            status = 'pending',
            submitted_at = NOW()
        `;
      }
      return res.status(200).json({ success: true });
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Action inconnue' });
}
