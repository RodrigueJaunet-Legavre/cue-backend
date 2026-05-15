const postgres = require('postgres');
const { Resend } = require('resend');
const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

async function getSignedUrl(supabaseUrl, supabaseKey, userId, fileType) {
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const path = `identity-docs/${userId}/${fileType}.${ext}`;
    const res = await fetch(`${supabaseUrl}/storage/v1/object/sign/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: 3600 })
    });
    const data = await res.json();
    if (data.signedURL) return `${supabaseUrl}/storage/v1${data.signedURL}`;
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = req.body;
  const { adminAction } = body;

  // LOGIN — pas besoin de vérifier adminSecret ici
  if (adminAction === 'login') {
    const { email, password } = body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      return res.status(200).json({ secret: process.env.ADMIN_SECRET });
    }
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Toutes les autres actions nécessitent adminSecret
  const { adminSecret } = body;
  if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Non autorisé' });

  // STATS
  if (adminAction === 'stats') {
    try {
      const [djs] = await sql`SELECT COUNT(*) FROM users WHERE user_type = 'dj'`;
      const [venues] = await sql`SELECT COUNT(*) FROM users WHERE user_type = 'venue'`;
      const [bookingsMonth] = await sql`SELECT COUNT(*) FROM bookings WHERE created_at >= date_trunc('month', NOW())`;
      const [bookingsTotal] = await sql`SELECT COUNT(*) FROM bookings`;
      const [revenueWeek] = await sql`SELECT COALESCE(SUM(amount),0) as total FROM payouts WHERE created_at >= NOW() - INTERVAL '7 days'`;
      const [revenueMonth] = await sql`SELECT COALESCE(SUM(amount),0) as total FROM payouts WHERE created_at >= date_trunc('month', NOW())`;
      const [revenueTotal] = await sql`SELECT COALESCE(SUM(amount),0) as total FROM payouts`;
      const [pendingVerif] = await sql`SELECT COUNT(*) FROM users WHERE identity_status = 'pending'`;
      const [openReports] = await sql`SELECT COUNT(*) FROM reports WHERE status = 'open'`;
      return res.status(200).json({
        djs: djs.count, venues: venues.count,
        bookingsMonth: bookingsMonth.count, bookingsTotal: bookingsTotal.count,
        revenueWeek: revenueWeek.total, revenueMonth: revenueMonth.total, revenueTotal: revenueTotal.total,
        pendingVerif: pendingVerif.count, openReports: openReports.count
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET USERS
  if (adminAction === 'get_users') {
    try {
      const { filter, status, type } = body;
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
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // VERIFY USER
  if (adminAction === 'verify_user') {
    try {
      const { userId, action, motif } = body;
      const statusMap = {
        approve: 'verified', reject: 'rejected',
        request_new: 'pending', suspend: 'suspended'
      };
      const newStatus = statusMap[action];
      if (!newStatus) return res.status(400).json({ error: 'Action inconnue' });
      await sql`UPDATE users SET identity_status = ${newStatus} WHERE id = ${userId}`;

      // Email selon l'action
      if (action !== 'suspend' && process.env.RESEND_API_KEY) {
        try {
          const [userRow] = await sql`SELECT * FROM users WHERE id = ${userId}`;
          if (userRow?.email) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            let subject, html;
            const firstName = userRow.first_name || 'DJ';

            if (action === 'approve') {
              subject = '✅ Ton identité a été vérifiée sur CUE';
              html = `<div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
                <h2 style="color:#FFC300;">Identité vérifiée ✅</h2>
                <p>Bonjour ${firstName},</p>
                <p>Ton identité a été vérifiée avec succès. Tu peux maintenant obtenir le badge vérifié CUE.</p>
                <a href="https://cuedj.eu/dashboard-dj.html" style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; display:inline-block; margin-top:16px;">Accéder à mon dashboard →</a>
              </div>`;
            } else if (action === 'request_new') {
              subject = '📋 Nouveaux documents requis — CUE';
              html = `<div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
                <h2 style="color:#FFC300;">Nouveaux documents requis</h2>
                <p>Bonjour ${firstName},</p>
                <p>Notre équipe a examiné vos documents et nécessite que vous en soumettez de nouveaux.</p>
                <div style="background:#1a1a1a; border-left:4px solid #FFC300; padding:16px; margin:20px 0; border-radius:0 8px 8px 0;">
                  <strong style="color:#FFC300;">Motif :</strong>
                  <p style="margin-top:8px; color:#ddd;">${motif || ''}</p>
                </div>
                <a href="https://cuedj.eu/dashboard-dj.html" style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; display:inline-block; margin-top:16px;">Soumettre de nouveaux documents →</a>
              </div>`;
            } else if (action === 'reject') {
              subject = '❌ Vérification d\'identité refusée — CUE';
              html = `<div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
                <h2 style="color:#ff4444;">Vérification refusée</h2>
                <p>Bonjour ${firstName},</p>
                <p>Nous n'avons pas pu vérifier votre identité. Si vous pensez qu'il s'agit d'une erreur, contactez notre support.</p>
                <a href="https://cuedj.eu" style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; display:inline-block; margin-top:16px;">Retour à CUE</a>
              </div>`;
            }

            if (subject && html) {
              await resend.emails.send({ from: 'CUE DJ <noreply@cuedj.eu>', to: userRow.email, subject, html });
            }
          }
        } catch (emailErr) {
          console.log('Email non envoyé:', emailErr.message);
        }
      }

      return res.status(200).json({ success: true, action, userId });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET DOCS
  if (adminAction === 'get_docs') {
    try {
      const { userId } = body;
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
      const [selfieUrl, documentUrl] = await Promise.all([
        getSignedUrl(supabaseUrl, supabaseKey, userId, 'selfie'),
        getSignedUrl(supabaseUrl, supabaseKey, userId, 'document')
      ]);
      return res.status(200).json({ selfieUrl, documentUrl });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'adminAction inconnue' });
}
