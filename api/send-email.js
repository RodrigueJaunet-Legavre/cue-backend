const { Resend } = require('resend');

module.exports = async function handler(req, res) {
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

    if (type === 'payment_validated') {
      const { amount, iban, bookingDate } = req.body;
      result = await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: email,
        subject: '💸 Ton paiement est en route !',
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h1 style="color:#FFC300; font-size:28px;">Virement en cours</h1>
            <p>Bonjour ${firstName},</p>
            <p>La venue a validé la prestation. Ton cachet est en cours de virement.</p>
            <div style="background:#111; border:1px solid rgba(255,195,0,.3); border-radius:12px; padding:24px; margin:24px 0;">
              <div style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Montant</div>
              <div style="font-size:36px; font-weight:900; color:#FFC300;">${amount}€</div>
              <div style="margin-top:16px; font-size:12px; color:#888; text-transform:uppercase; letter-spacing:1px;">IBAN</div>
              <div style="font-size:14px; color:#ddd; font-family:monospace; margin-top:4px;">${iban}</div>
              ${bookingDate ? `<div style="margin-top:12px; font-size:12px; color:#888; text-transform:uppercase; letter-spacing:1px;">Prestation du</div><div style="font-size:14px; color:#ddd; margin-top:4px;">${new Date(bookingDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>` : ''}
            </div>
            <p style="color:#bbb; font-size:13px;">Délai habituel : 1 à 3 jours ouvrés.</p>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform — cuedj.eu</p>
          </div>
        `
      });
    }

    if (type === 'admin_payout') {
      const { djName, amount, iban, bic, bankName, bookingId } = req.body;
      result = await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: email,
        subject: `💸 Virement à effectuer — ${djName} — ${amount}€`,
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h1 style="color:#FFC300; font-size:24px;">Virement à effectuer</h1>
            <div style="background:#111; border:1px solid rgba(255,195,0,.3); border-radius:12px; padding:24px; margin:24px 0;">
              <table style="width:100%; border-collapse:collapse;">
                <tr><td style="color:#888; font-size:12px; padding:6px 0; width:100px;">BOOKING</td><td style="color:#ddd;">#${bookingId}</td></tr>
                <tr><td style="color:#888; font-size:12px; padding:6px 0;">DJ</td><td style="color:#ddd;">${djName}</td></tr>
                <tr><td style="color:#888; font-size:12px; padding:6px 0;">MONTANT NET</td><td style="color:#FFC300; font-weight:700; font-size:18px;">${amount}€</td></tr>
                <tr><td style="color:#888; font-size:12px; padding:6px 0;">IBAN</td><td style="color:#ddd; font-family:monospace;">${iban}</td></tr>
                ${bic ? `<tr><td style="color:#888; font-size:12px; padding:6px 0;">BIC</td><td style="color:#ddd;">${bic}</td></tr>` : ''}
                ${bankName ? `<tr><td style="color:#888; font-size:12px; padding:6px 0;">BANQUE</td><td style="color:#ddd;">${bankName}</td></tr>` : ''}
              </table>
            </div>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform</p>
          </div>
        `
      });
    }

    if (type === 'admin_org_verification') {
      const { userName, userEmail, orgName, orgSiret, docUrl, userId } = req.body;
      result = await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: email,
        subject: `🏢 Vérification organisation — ${orgName}`,
        html: `
          <div style="font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h2 style="color:#FFC300;">Nouvelle demande de vérification organisation</h2>
            <table style="width:100%; border-collapse:collapse; margin:20px 0;">
              <tr><td style="padding:10px; border:1px solid #ddd; font-weight:bold;">Utilisateur</td><td style="padding:10px; border:1px solid #ddd;">${userName}</td></tr>
              <tr><td style="padding:10px; border:1px solid #ddd; font-weight:bold;">Email</td><td style="padding:10px; border:1px solid #ddd;">${userEmail}</td></tr>
              <tr><td style="padding:10px; border:1px solid #ddd; font-weight:bold;">Organisation</td><td style="padding:10px; border:1px solid #ddd;">${orgName}</td></tr>
              <tr><td style="padding:10px; border:1px solid #ddd; font-weight:bold;">SIRET/SIREN</td><td style="padding:10px; border:1px solid #ddd; font-family:monospace;">${orgSiret}</td></tr>
              <tr><td style="padding:10px; border:1px solid #ddd; font-weight:bold;">Document</td><td style="padding:10px; border:1px solid #ddd;">${docUrl ? `<a href="${docUrl}">Voir le document</a>` : '—'}</td></tr>
            </table>
            <a href="https://cuedj.eu/cue-secure-admin-panel.html" style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; display:inline-block;">
              Gérer dans l'admin →
            </a>
          </div>
        `
      });
    }

    if (type === 'admin_verification') {
      const adminEmail = process.env.ADMIN_EMAIL || 'cue.dj.app@gmail.com';
      const body = req.body;
      result = await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: adminEmail,
        subject: `🪪 Nouvelle demande de vérification — ${body.userName}`,
        html: `
          <div style="font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h2 style="color:#FFC300; background:#080808; padding:20px; border-radius:12px;">
              🪪 Nouvelle demande de vérification
            </h2>
            <table style="width:100%; border-collapse:collapse; margin:20px 0;">
              <tr><td style="padding:10px; border:1px solid #ddd; font-weight:bold;">Utilisateur</td>
                  <td style="padding:10px; border:1px solid #ddd;">${body.userName}</td></tr>
              <tr><td style="padding:10px; border:1px solid #ddd; font-weight:bold;">Email</td>
                  <td style="padding:10px; border:1px solid #ddd;">${body.userEmail}</td></tr>
              <tr><td style="padding:10px; border:1px solid #ddd; font-weight:bold;">Type</td>
                  <td style="padding:10px; border:1px solid #ddd;">${body.userType || 'DJ'}</td></tr>
              <tr><td style="padding:10px; border:1px solid #ddd; font-weight:bold;">ID</td>
                  <td style="padding:10px; border:1px solid #ddd; font-family:monospace;">${body.userId}</td></tr>
            </table>
            ${body.selfieUrl ? `
            <div style="margin:16px 0;">
              <strong>📸 Selfie :</strong><br>
              <a href="${body.selfieUrl}" style="color:#FFC300;">${body.selfieUrl}</a>
            </div>` : ''}
            ${body.docUrl ? `
            <div style="margin:16px 0;">
              <strong>🪪 Document :</strong><br>
              <a href="${body.docUrl}" style="color:#FFC300;">${body.docUrl}</a>
            </div>` : ''}
            ${body.orgName ? `
            <div style="margin:16px 0;">
              <strong>🏢 Organisation :</strong> ${body.orgName}<br>
              <strong>SIRET :</strong> ${body.orgSiret || '—'}
            </div>` : ''}
            <a href="https://cuedj.eu/cue-secure-admin-panel.html"
               style="display:inline-block; background:#FFC300; color:#000; padding:14px 32px;
                      border-radius:8px; text-decoration:none; font-weight:700; margin-top:16px;">
              Gérer dans l'admin →
            </a>
          </div>
        `
      });
    }

    if (type === 'identity_approved') {
      result = await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: email,
        subject: '✅ Votre identité a été vérifiée — CUE',
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h2 style="color:#FFC300;">✅ Identité vérifiée !</h2>
            <p>Bonjour ${firstName},</p>
            <p>Bonne nouvelle — votre identité a été <strong style="color:#00c864;">vérifiée avec succès</strong> par notre équipe.</p>
            <p>Vous pouvez maintenant obtenir le badge vérifié CUE sur votre profil.</p>
            <a href="https://cuedj.eu/dashboard-dj.html"
               style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px;
                      text-decoration:none; font-weight:700; display:inline-block; margin-top:20px;">
              Voir mon profil →
            </a>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform — cuedj.eu</p>
          </div>
        `
      });
    }

    if (type === 'identity_rejected') {
      const { motif } = req.body;
      result = await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: email,
        subject: "❌ Vérification d'identité refusée — CUE",
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h2 style="color:#ff4444;">❌ Vérification refusée</h2>
            <p>Bonjour ${firstName},</p>
            <p>Votre demande de vérification d'identité a été <strong style="color:#ff4444;">refusée</strong>.</p>
            ${motif ? `
            <div style="background:#1a0000; border:1px solid rgba(255,68,68,.3); border-radius:12px; padding:16px 20px; margin:20px 0;">
              <div style="font-weight:700; color:#ff4444; margin-bottom:6px;">Motif du refus :</div>
              <div style="color:#ddd;">${motif}</div>
            </div>` : ''}
            <p>Si vous pensez qu'il s'agit d'une erreur, contactez notre support.</p>
            <a href="https://cuedj.eu"
               style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px;
                      text-decoration:none; font-weight:700; display:inline-block; margin-top:20px;">
              Contacter le support →
            </a>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform — cuedj.eu</p>
          </div>
        `
      });
    }

    if (type === 'identity_new_docs') {
      const { motif, docsRequired } = req.body;
      const docsLabels = {
        selfie: "Selfie avec pièce d'identité",
        cni: "Carte nationale d'identité",
        passport: 'Passeport',
        kbis: 'Extrait Kbis',
        siret: 'Document SIRET/SIREN'
      };
      const docsList = (docsRequired || []).map(d => `<li>${docsLabels[d] || d}</li>`).join('');
      result = await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: email,
        subject: '📋 Nouveaux documents requis pour votre vérification — CUE',
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h2 style="color:#FFC300;">📋 Documents supplémentaires requis</h2>
            <p>Bonjour ${firstName},</p>
            <p>Notre équipe a examiné votre dossier et a besoin de documents supplémentaires pour valider votre identité.</p>
            ${motif ? `
            <div style="background:#1a1500; border:1px solid rgba(255,195,0,.3); border-radius:12px; padding:16px 20px; margin:20px 0;">
              <div style="font-weight:700; color:#FFC300; margin-bottom:6px;">Message de notre équipe :</div>
              <div style="color:#ddd;">${motif}</div>
            </div>` : ''}
            ${docsList ? `
            <div style="background:#111; border-radius:12px; padding:16px 20px; margin:20px 0;">
              <div style="font-weight:700; color:#fff; margin-bottom:10px;">Documents à fournir :</div>
              <ul style="color:#ddd; line-height:2; padding-left:20px;">${docsList}</ul>
            </div>` : ''}
            <a href="https://cuedj.eu/dashboard-dj.html"
               style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px;
                      text-decoration:none; font-weight:700; display:inline-block; margin-top:20px;">
              Renvoyer mes documents →
            </a>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform — cuedj.eu</p>
          </div>
        `
      });
    }

    if (type === 'contract_fully_signed') {
      result = await resend.emails.send({
        from: 'CUE DJ <noreply@cuedj.eu>',
        to: email,
        subject: '✅ Contrat signé par les deux parties — CUE',
        html: `
          <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
            <h2 style="color:#FFC300;">🎉 Contrat finalisé !</h2>
            <p>Bonjour ${req.body.firstName},</p>
            <p>Le contrat a été signé par les deux parties. Vous pouvez maintenant le télécharger.</p>
            <div style="background:#111; border:1px solid #333; border-radius:12px; padding:20px; margin:24px 0;">
              <div style="font-weight:700; color:#fff; margin-bottom:12px;">✍️ Signatures :</div>
              ${(req.body.signers || []).map((name, i) => `
                <div style="color:#ddd; margin-bottom:6px;">• ${name} — ${new Date(req.body.dates[i]).toLocaleDateString('fr-FR')}</div>
              `).join('')}
            </div>
            <table style="width:100%; border-collapse:separate; border-spacing:12px; margin-top:24px;">
              <tr>
                <td style="width:50%;">
                  <a href="${req.body.contractLink}"
                     style="display:block; background:#111; color:#FFC300; padding:14px 24px; border-radius:8px;
                            text-decoration:none; font-weight:700; text-align:center; border:1px solid #FFC300;">
                    👁 Voir le contrat
                  </a>
                </td>
                <td style="width:50%;">
                  <a href="${req.body.downloadLink}"
                     style="display:block; background:#FFC300; color:#000; padding:14px 24px; border-radius:8px;
                            text-decoration:none; font-weight:700; text-align:center;">
                    📥 Télécharger PDF
                  </a>
                </td>
              </tr>
            </table>
            <hr style="border-color:#222; margin:32px 0;">
            <p style="color:#555; font-size:12px;">© 2026 CUE DJ Platform — cuedj.eu</p>
          </div>
        `
      });
    }

    console.log('Resend result:', JSON.stringify(result));
    return res.status(200).json({
      success: true,
      resendResult: result,
      resendError: result?.error || null
    });
  } catch (err) {
    console.log('ERREUR:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
