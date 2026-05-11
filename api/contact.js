const { Resend } = require('resend');
const postgres = require('postgres');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { type, senderName, senderEmail, subject, message, category, reportedUser } = req.body;
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    if (type === 'contact') {
      await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: 'cue.dj.app@gmail.com',
        subject: `[CONTACT] ${subject} — ${senderName}`,
        html: `<div style="background:#080808; color:#ddd; font-family:Arial; padding:40px;"><h2 style="color:#FFC300;">Nouveau message de contact</h2><p><strong>De :</strong> ${senderName} (${senderEmail})</p><p><strong>Sujet :</strong> ${subject}</p><hr style="border-color:#333;"><p>${message.replace(/\n/g, '<br>')}</p></div>`
      });
      await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: senderEmail,
        subject: '✅ Nous avons bien reçu ton message — CUE',
        html: `<div style="background:#080808; color:#ddd; font-family:Arial; padding:40px;"><h2 style="color:#FFC300;">Message bien reçu ✅</h2><p>Bonjour ${senderName}, nous t'apporterons une réponse sous 24h.</p></div>`
      });
    }

    if (type === 'report') {
      const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });
      await sql`
        INSERT INTO reports (id, reporter_id, reported_id, type, description, status, created_at)
        VALUES (${Date.now().toString()}, ${senderEmail}, ${reportedUser || 'unknown'}, ${category}, ${message}, 'open', NOW())
      `;
      await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: 'cue.dj.app@gmail.com',
        subject: `🚨 [SIGNALEMENT] ${category} — ${senderName}`,
        html: `<div style="background:#080808; color:#ddd; font-family:Arial; padding:40px;"><h2 style="color:#ff4444;">Nouveau signalement 🚨</h2><p><strong>De :</strong> ${senderName} (${senderEmail})</p><p><strong>Catégorie :</strong> ${category}</p><p>${message.replace(/\n/g, '<br>')}</p></div>`
      });
      await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: senderEmail,
        subject: '✅ Signalement bien reçu — CUE',
        html: `<div style="background:#080808; color:#ddd; font-family:Arial; padding:40px;"><h2 style="color:#FFC300;">Signalement reçu ✅</h2><p>Bonjour ${senderName}, ton signalement a été enregistré.</p></div>`
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
