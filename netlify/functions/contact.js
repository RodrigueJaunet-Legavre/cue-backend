const { Resend } = require('resend');

exports.handler = async (event) => {
  const { type, senderName, senderEmail, subject, message, category, reportedUser } = JSON.parse(event.body);
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    if (type === 'contact') {
      // Email à l'équipe CUE
      await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: 'cue.dj.app@gmail.com',
        subject: `[CONTACT] ${subject} — ${senderName}`,
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h2 style="color:#FFC300;">Nouveau message de contact</h2>
            <p><strong>De :</strong> ${senderName} (${senderEmail})</p>
            <p><strong>Sujet :</strong> ${subject}</p>
            <hr style="border-color:#333; margin:24px 0;">
            <p style="line-height:1.8; color:#bbb;">${message.replace(/\n/g, '<br>')}</p>
            <hr style="border-color:#333; margin:24px 0;">
            <p style="color:#555; font-size:12px;">Reçu via cuedj.eu</p>
          </div>
        `
      });

      // Email de confirmation à l'utilisateur
      await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: senderEmail,
        subject: '✅ Nous avons bien reçu ton message — CUE',
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h2 style="color:#FFC300;">Message bien reçu ✅</h2>
            <p>Bonjour ${senderName},</p>
            <p>Nous avons bien reçu ton message et nous t'apporterons une réponse <strong style="color:#FFC300;">sous 24h</strong>.</p>
            <div style="background:#111; border:1px solid rgba(255,195,0,.13); border-radius:12px; padding:20px; margin:24px 0;">
              <p style="color:#888; font-size:12px; margin-bottom:8px;">TON MESSAGE</p>
              <p style="color:#bbb; line-height:1.6;">${message.replace(/\n/g, '<br>')}</p>
            </div>
            <p style="color:#bbb;">L'équipe CUE</p>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform — cuedj.eu</p>
          </div>
        `
      });
    }

    if (type === 'report') {
      // Sauvegarde dans la DB
      const postgres = require('postgres');
      const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

      await sql`
        INSERT INTO reports (id, reporter_id, reported_id, type, description, status, created_at)
        VALUES (
          ${Date.now().toString()},
          ${senderEmail},
          ${reportedUser || 'unknown'},
          ${category},
          ${message},
          'open',
          NOW()
        )
      `;

      // Email à l'équipe CUE
      await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: 'cue.dj.app@gmail.com',
        subject: `🚨 [SIGNALEMENT] ${category} — ${senderName}`,
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h2 style="color:#ff4444;">Nouveau signalement 🚨</h2>
            <p><strong>De :</strong> ${senderName} (${senderEmail})</p>
            <p><strong>Catégorie :</strong> <span style="color:#FFC300;">${category}</span></p>
            ${reportedUser ? `<p><strong>Utilisateur signalé :</strong> ${reportedUser}</p>` : ''}
            <hr style="border-color:#333; margin:24px 0;">
            <p style="line-height:1.8; color:#bbb;">${message.replace(/\n/g, '<br>')}</p>
            <hr style="border-color:#333; margin:24px 0;">
            <p style="color:#555; font-size:12px;">Visible dans l'admin CUE → Reports</p>
          </div>
        `
      });

      // Confirmation à l'utilisateur
      await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: senderEmail,
        subject: '✅ Signalement bien reçu — CUE',
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h2 style="color:#FFC300;">Signalement reçu ✅</h2>
            <p>Bonjour ${senderName},</p>
            <p>Ton signalement a bien été enregistré et sera traité par notre équipe <strong style="color:#FFC300;">sous 24h</strong>.</p>
            <p style="color:#bbb;">Catégorie : <strong style="color:#fff;">${category}</strong></p>
            <p style="color:#bbb; margin-top:24px;">Merci de contribuer à la sécurité de la communauté CUE.</p>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform — cuedj.eu</p>
          </div>
        `
      });
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.log('Erreur contact:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
