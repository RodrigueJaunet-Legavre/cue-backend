const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  const { type, email, firstName, code } = JSON.parse(event.body);

  try {
    if (type === 'verification') {
      await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: email,
        subject: 'Ton code de vérification CUE',
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <img src="https://cuedj.eu/logo.png" width="80" style="margin-bottom:24px;">
            <h1 style="color:#FFC300; font-size:28px;">Vérifie ton email</h1>
            <p>Bonjour ${firstName},</p>
            <p>Voici ton code de vérification :</p>
            <div style="background:#111; border:2px solid #FFC300; border-radius:12px; padding:24px; text-align:center; margin:24px 0;">
              <span style="font-size:42px; font-weight:900; color:#FFC300; letter-spacing:12px;">${code}</span>
            </div>
            <p style="color:#bbb;">Ce code expire dans 10 minutes.</p>
            <p style="color:#bbb;">Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform — cuedj.eu</p>
          </div>
        `
      });
    }

    if (type === 'welcome') {
      await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: email,
        subject: `Bienvenue sur CUE, ${firstName} 🎧`,
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <img src="https://cuedj.eu/logo.png" width="80" style="margin-bottom:24px;">
            <h1 style="color:#FFC300; font-size:32px;">THE STAGE STARTS HERE.</h1>
            <p>Bonjour ${firstName},</p>
            <p>Ton compte CUE est maintenant actif. Tu fais partie de la plateforme qui connecte les meilleurs DJs avec les meilleurs événements.</p>
            <div style="background:#111; border:1px solid rgba(255,195,0,0.13); border-radius:12px; padding:24px; margin:24px 0;">
              <h3 style="color:#FFC300; margin-top:0;">Ce que tu peux faire maintenant :</h3>
              <p>✅ Compléter ton profil DJ</p>
              <p>✅ Accéder à l'AI Matching</p>
              <p>✅ Générer des contrats professionnels</p>
              <p>✅ Recevoir des bookings</p>
            </div>
            <a href="https://cuedj.eu/dashboard.html"
               style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; display:inline-block; margin:16px 0;">
              Accéder à mon dashboard →
            </a>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform — cuedj.eu</p>
          </div>
        `
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
