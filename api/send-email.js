const { Resend } = require('resend');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { type, email, firstName, code } = req.body;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    let result;

    if (type === 'verification') {
      result = await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: email,
        subject: 'Ton code de vérification CUE',
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h1 style="color:#FFC300; font-size:28px;">Vérifie ton email</h1>
            <p>Bonjour ${firstName},</p>
            <p>Voici ton code de vérification :</p>
            <div style="background:#111; border:2px solid #FFC300; border-radius:12px; padding:24px; text-align:center; margin:24px 0;">
              <span style="font-size:42px; font-weight:900; color:#FFC300; letter-spacing:12px;">${code}</span>
            </div>
            <p style="color:#bbb;">Ce code expire dans 10 minutes.</p>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform — cuedj.eu</p>
          </div>
        `
      });
    }

    if (type === 'welcome') {
      result = await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: email,
        subject: `Bienvenue sur CUE, ${firstName} 🎧`,
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h1 style="color:#FFC300; font-size:32px;">THE STAGE STARTS HERE.</h1>
            <p>Bonjour ${firstName},</p>
            <p>Ton compte CUE est maintenant actif.</p>
            <a href="https://cuedj.eu/dashboard-dj.html"
               style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; display:inline-block; margin:16px 0;">
              Accéder à mon dashboard →
            </a>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform — cuedj.eu</p>
          </div>
        `
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.log('ERREUR:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
