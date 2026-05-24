const postgres = require('postgres');
const { Resend } = require('resend');
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

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
      const [usersCount] = await sql`SELECT COUNT(*) as count FROM users`;
      const [djsCount] = await sql`SELECT COUNT(*) as count FROM users WHERE user_type = 'dj'`;
      const [venuesCount] = await sql`SELECT COUNT(*) as count FROM users WHERE user_type = 'venue'`;
      const [bookingsCount] = await sql`SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed'`;
      const [revenueResult] = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM bookings WHERE status = 'confirmed'`;
      const [pendingVerif] = await sql`SELECT COUNT(*) as count FROM users WHERE identity_status = 'pending'`;
      const [reportsCount] = await sql`SELECT COUNT(*) as count FROM reports WHERE status = 'open'`;
      return res.status(200).json({
        stats: {
          totalUsers: parseInt(usersCount.count),
          totalDJs: parseInt(djsCount.count),
          totalVenues: parseInt(venuesCount.count),
          totalBookings: parseInt(bookingsCount.count),
          totalRevenue: parseFloat(revenueResult.total),
          pendingVerifications: parseInt(pendingVerif.count),
          openReports: parseInt(reportsCount.count)
        },
        // legacy keys for backward compat
        djs: djsCount.count, venues: venuesCount.count,
        bookingsTotal: bookingsCount.count, bookingsMonth: bookingsCount.count,
        pendingVerif: pendingVerif.count, openReports: reportsCount.count
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (adminAction === 'get_bookings') {
    try {
      const bookings = await sql`
        SELECT b.*,
               dj.first_name as dj_first, dj.last_name as dj_last,
               v.first_name as venue_first, v.last_name as venue_last
        FROM bookings b
        LEFT JOIN users dj ON b.dj_id = dj.id
        LEFT JOIN users v ON b.venue_id = v.id
        ORDER BY b.created_at DESC
        LIMIT 100
      `;
      const enriched = bookings.map(b => ({
        ...b,
        dj_name: b.dj_name || ((b.dj_first || '') + ' ' + (b.dj_last || '')).trim() || 'DJ',
        venue_name: b.venue_name || ((b.venue_first || '') + ' ' + (b.venue_last || '')).trim() || 'Venue'
      }));
      return res.status(200).json({ bookings: enriched });
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
      if (action === 'approve') {
        await sql`UPDATE identity_documents SET status = 'approved' WHERE user_id = ${userId}`;
      } else if (action === 'reject' || action === 'request_new') {
        await sql`UPDATE identity_documents SET status = 'rejected' WHERE user_id = ${userId}`;
      }

      // Email selon l'action
      if (action !== 'suspend') {
        try {
          const [userRow] = await sql`SELECT * FROM users WHERE id = ${userId}`;
          if (userRow?.email) {
            const typeMap = { approve: 'identity_approved', reject: 'identity_rejected', request_new: 'identity_new_docs' };
            const emailType = typeMap[action];
            if (emailType) {
              await fetch('https://cuedj.eu/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: emailType,
                  email: userRow.email,
                  firstName: userRow.first_name || '',
                  motif: motif || ''
                })
              });
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
    const { userId } = body;
    try {
      const docs = await sql`
        SELECT * FROM identity_documents
        WHERE user_id = ${userId}
        AND status = 'pending'
        ORDER BY submitted_at DESC
      `;

      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      const docsWithUrls = await Promise.all(docs.map(async (doc) => {
        const url = doc.document_url || '';
        const path = url.includes('/identity-docs/')
          ? url.split('/identity-docs/')[1].split('?')[0]
          : null;
        if (!path) return { ...doc, signedUrl: url };
        const { data } = await supabaseAdmin.storage
          .from('identity-docs')
          .createSignedUrl(path, 3600);
        return {
          ...doc,
          signedUrl: data?.signedUrl || url,
          label: doc.document_type === 'selfie' ? '🤳 Selfie'
            : doc.document_type === 'cni' ? "🪪 Pièce d'identité"
            : doc.document_type === 'legal_doc' ? '📄 Document légal (SIRET/KBIS)'
            : '📎 Document'
        };
      }));

      const [user] = await sql`SELECT * FROM users WHERE id = ${userId}`;

      return res.status(200).json({
        allDocs: docsWithUrls.map(d => ({
          url: d.signedUrl,
          type: d.label,
          submittedAt: d.submitted_at
        })),
        orgName: user?.org_name,
        orgSiret: user?.org_siret
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // TOGGLE SUSPEND
  if (adminAction === 'toggle_suspend') {
    try {
      const { userId } = body;
      const [userRow] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      if (!userRow) return res.status(404).json({ error: 'Utilisateur introuvable' });
      const newSuspended = !userRow.suspended;
      await sql`UPDATE users SET suspended = ${newSuspended} WHERE id = ${userId}`;

      if (process.env.RESEND_API_KEY && userRow.email) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const firstName = userRow.first_name || 'Utilisateur';
          if (newSuspended) {
            await resend.emails.send({
              from: 'CUE DJ <noreply@cuedj.eu>',
              to: userRow.email,
              subject: '🚫 Compte suspendu — CUE',
              html: `<div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
                <h2 style="color:#ff4444;">Compte suspendu</h2>
                <p>Bonjour ${firstName},</p>
                <p>Votre compte CUE a été suspendu. Pour plus d'informations, contactez notre support.</p>
                <a href="https://cuedj.eu" style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; display:inline-block; margin-top:16px;">Retour à CUE</a>
              </div>`
            });
          } else {
            await resend.emails.send({
              from: 'CUE DJ <noreply@cuedj.eu>',
              to: userRow.email,
              subject: '✅ Compte réactivé — CUE',
              html: `<div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
                <h2 style="color:#FFC300;">Compte réactivé ✅</h2>
                <p>Bonjour ${firstName},</p>
                <p>Votre compte CUE a été réactivé. Vous pouvez de nouveau accéder à la plateforme.</p>
                <a href="https://cuedj.eu/login.html" style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; display:inline-block; margin-top:16px;">Se connecter →</a>
              </div>`
            });
          }
        } catch (emailErr) {
          console.log('Email non envoyé:', emailErr.message);
        }
      }

      return res.status(200).json({ success: true, suspended: newSuspended });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // REQUEST NEW DOCS
  if (adminAction === 'request_new_docs') {
    try {
      const { userId, motif, docs } = body;
      await sql`UPDATE users SET identity_status = 'rejected', identity_motif = ${motif || null}, identity_docs_required = ${docs ? JSON.stringify(docs) : null} WHERE id = ${userId}`;
      await sql`UPDATE identity_documents SET status = 'rejected' WHERE user_id = ${userId}`;
      const [userRow] = await sql`SELECT * FROM users WHERE id = ${userId}`;
      if (userRow?.email) {
        try {
          await fetch('https://cuedj.eu/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'identity_new_docs',
              email: userRow.email,
              firstName: userRow.first_name || '',
              motif: motif || '',
              docsRequired: docs || []
            })
          });
        } catch (emailErr) {
          console.log('Email non envoyé:', emailErr.message);
        }
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (adminAction === 'get_payouts') {
    try {
      const payouts = await sql`
        SELECT b.id, b.event_date, b.dj_amount, b.commission_amount, b.amount,
               b.payment_status, b.payout_status, b.released_at,
               dj.first_name as dj_first, dj.last_name as dj_last,
               dj.email as dj_email, dj.iban, dj.bic, dj.bank_name,
               v.first_name as venue_first, v.last_name as venue_last
        FROM bookings b
        LEFT JOIN users dj ON b.dj_id = dj.id
        LEFT JOIN users v ON b.venue_id = v.id
        WHERE b.payment_status IN ('released', 'paid')
        ORDER BY b.released_at DESC NULLS LAST, b.event_date DESC
        LIMIT 100
      `;
      return res.status(200).json({ payouts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'adminAction inconnue' });
}
