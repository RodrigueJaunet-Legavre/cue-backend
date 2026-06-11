const postgres = require('postgres');
const { Resend } = require('resend');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = req.body || {};
  const { action } = body;

  // Crée un contrat depuis un booking confirmé
  if (action === 'create_from_booking') {
    const { bookingId } = body;
    try {
      const existing = await sql`SELECT id FROM contracts WHERE booking_id = ${bookingId}`;
      if (existing.length) {
        return res.status(200).json({ contractId: existing[0].id });
      }

      const [booking] = await sql`
        SELECT b.*,
               dj.first_name as dj_first, dj.last_name as dj_last,
               dj.email as dj_email, dj.phone as dj_phone,
               v.first_name as venue_first, v.last_name as venue_last,
               v.email as venue_email, v.phone as venue_phone
        FROM bookings b
        LEFT JOIN users dj ON b.dj_id = dj.id
        LEFT JOIN users v ON b.venue_id = v.id
        WHERE b.id = ${bookingId}
      `;
      if (!booking) return res.status(404).json({ error: 'Booking non trouvé' });

      const contractId = 'CTR-' + Date.now();

      await sql`
        INSERT INTO contracts (
          id, booking_id, dj_id, venue_id,
          event_date, event_type, amount,
          dj_name, venue_name,
          dj_email, dj_phone,
          venue_email, venue_phone,
          status
        ) VALUES (
          ${contractId}, ${bookingId}, ${booking.dj_id}, ${booking.venue_id},
          ${booking.event_date}, ${booking.event_type || 'Prestation DJ'}, ${booking.amount},
          ${(booking.dj_first || '') + ' ' + (booking.dj_last || '')},
          ${(booking.venue_first || '') + ' ' + (booking.venue_last || '')},
          ${booking.dj_email || ''}, ${booking.dj_phone || ''},
          ${booking.venue_email || ''}, ${booking.venue_phone || ''},
          'draft'
        )
      `;

      // Notifie les deux parties
      if (booking.dj_email || booking.venue_email) {
        const to = [booking.dj_email, booking.venue_email].filter(Boolean);
        await resend.emails.send({
          from: 'CUE DJ <noreply@cuedj.eu>',
          to,
          subject: '📄 Contrat à compléter — CUE',
          html: `
            <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
              <h2 style="color:#FFC300;">Votre contrat est prêt à être complété</h2>
              <p>Le booking du <strong>${booking.event_date}</strong> a été confirmé.
              Chaque partie doit maintenant compléter sa section du contrat.</p>
              <a href="https://cuedj.eu/dashboard-dj.html"
                 style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px;
                        text-decoration:none; font-weight:700; display:inline-block; margin-top:16px;">
                Compléter mon contrat →
              </a>
            </div>
          `
        }).catch(e => console.log('Email error:', e.message));
      }

      return res.status(200).json({ contractId, contract: { id: contractId } });
    } catch (err) {
      console.log('Erreur create_from_booking:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // Récupère un contrat
  if (action === 'get_contract') {
    const { contractId, bookingId } = body;
    try {
      let contract;
      if (contractId) {
        [contract] = await sql`SELECT * FROM contracts WHERE id = ${contractId}`;
      } else if (bookingId) {
        [contract] = await sql`SELECT * FROM contracts WHERE booking_id = ${bookingId}`;
      }
      return res.status(200).json({ contract: contract || null });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DJ complète sa partie
  if (action === 'save_dj_part') {
    const { contractId, djId, data } = body;
    try {
      await sql`
        UPDATE contracts SET
          dj_legal_name = ${data.legalName || ''},
          dj_address    = ${data.address || ''},
          dj_phone      = ${data.phone || ''},
          dj_email      = ${data.email || ''},
          dj_equipment  = ${data.equipment || ''},
          dj_rider      = ${data.rider || ''},
          dj_completed  = true,
          status = CASE
            WHEN venue_completed = true THEN 'ready_to_sign'
            ELSE 'dj_pending'
          END,
          updated_at = NOW()
        WHERE id = ${contractId} AND dj_id = ${djId}
      `;
      const [contract] = await sql`SELECT * FROM contracts WHERE id = ${contractId}`;

      if (contract.venue_completed) {
        const aiText = await generateContractWithAI(contract);
        if (aiText) {
          await sql`UPDATE contracts SET ai_generated_text = ${aiText}, status = 'ready_to_sign', updated_at = NOW() WHERE id = ${contractId}`;
          contract.ai_generated_text = aiText;
          contract.status = 'ready_to_sign';
        }
        await notifyBothParties(contract, 'ready_to_sign');
      }

      const [updated] = await sql`SELECT * FROM contracts WHERE id = ${contractId}`;
      return res.status(200).json({ success: true, contract: updated });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Venue complète sa partie
  if (action === 'save_venue_part') {
    const { contractId, venueId, data } = body;
    try {
      await sql`
        UPDATE contracts SET
          venue_legal_name = ${data.legalName || ''},
          venue_address    = ${data.address || ''},
          venue_phone      = ${data.phone || ''},
          venue_contact    = ${data.contact || ''},
          venue_location   = ${data.location || ''},
          venue_equipment  = ${data.equipment || ''},
          venue_schedule   = ${data.schedule || ''},
          venue_conditions = ${data.conditions || ''},
          venue_completed  = true,
          status = CASE
            WHEN dj_completed = true THEN 'ready_to_sign'
            ELSE 'venue_pending'
          END,
          updated_at = NOW()
        WHERE id = ${contractId} AND venue_id = ${venueId}
      `;
      const [contract] = await sql`SELECT * FROM contracts WHERE id = ${contractId}`;

      if (contract.dj_completed) {
        const aiText = await generateContractWithAI(contract);
        if (aiText) {
          await sql`UPDATE contracts SET ai_generated_text = ${aiText}, status = 'ready_to_sign', updated_at = NOW() WHERE id = ${contractId}`;
          contract.ai_generated_text = aiText;
          contract.status = 'ready_to_sign';
        }
        await notifyBothParties(contract, 'ready_to_sign');
      }

      const [updated] = await sql`SELECT * FROM contracts WHERE id = ${contractId}`;
      return res.status(200).json({ success: true, contract: updated });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Signature
  if (action === 'sign') {
    const { contractId, userId, userType } = body;
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const now = new Date().toISOString();

    try {
      if (userType === 'dj') {
        await sql`
          UPDATE contracts SET
            dj_signed      = true,
            dj_signed_at   = ${now},
            dj_sign_ip     = ${ip},
            status         = CASE WHEN venue_signed = true THEN 'signed' ELSE status END,
            finalized_at   = CASE WHEN venue_signed = true THEN NOW() ELSE null END,
            updated_at     = NOW()
          WHERE id = ${contractId} AND dj_id = ${userId}
        `;
      } else {
        await sql`
          UPDATE contracts SET
            venue_signed    = true,
            venue_signed_at = ${now},
            venue_sign_ip   = ${ip},
            status          = CASE WHEN dj_signed = true THEN 'signed' ELSE status END,
            finalized_at    = CASE WHEN dj_signed = true THEN NOW() ELSE null END,
            updated_at      = NOW()
          WHERE id = ${contractId} AND venue_id = ${userId}
        `;
      }

      const [contract] = await sql`SELECT * FROM contracts WHERE id = ${contractId}`;

      if (contract.status === 'signed') {
        await sendFinalContract(contract);
      }

      return res.status(200).json({ success: true, contract });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Liste des contrats d'un user
  if (action === 'get_user_contracts') {
    const { userId, userType } = body;
    try {
      const field = userType === 'dj' ? 'dj_id' : 'venue_id';
      const contracts = await sql`
        SELECT * FROM contracts
        WHERE ${sql(field)} = ${userId}
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ contracts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'get_generated_contract') {
    const { contractId } = body;
    try {
      const [contract] = await sql`SELECT * FROM generated_contracts WHERE id = ${contractId}`;
      return res.status(200).json({ contract: contract || null });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'sign_generated_contract') {
    const { contractId, signerName, signedAt, userId, conversationId } = body;
    const ip = req.headers['x-forwarded-for'] || 'unknown';
    try {
      await sql`
        UPDATE generated_contracts SET
          signed_by = array_append(COALESCE(signed_by, ARRAY[]::text[]),        ${signerName}),
          signed_at = array_append(COALESCE(signed_at, ARRAY[]::timestamptz[]), ${signedAt}::timestamptz),
          signed_ip = array_append(COALESCE(signed_ip, ARRAY[]::text[]),        ${ip})
        WHERE id = ${contractId}
      `;

      const [contract] = await sql`SELECT * FROM generated_contracts WHERE id = ${contractId}`;
      const signaturesCount = (contract.signed_by || []).length;
      const allSigned = signaturesCount >= 2;

      // Notifie dans la conversation
      if (conversationId) {
        const notifContent = allSigned
          ? `✅ Contrat signé par les deux parties !\n\nSignataires :\n${(contract.signed_by || []).map((name, i) => `• ${name} — ${new Date(contract.signed_at[i]).toLocaleDateString('fr-FR')}`).join('\n')}\n\n📥 Télécharger : https://cuedj.eu/contract-view.html?id=${contractId}&download=true`
          : `✍️ ${signerName} a signé le contrat.\n\nEn attente de la signature de l'autre partie.\n\n🔗 Voir le contrat : https://cuedj.eu/contract-view.html?id=${contractId}&sign=true`;
        await sql`
          INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at)
          VALUES (${Date.now().toString()}, ${conversationId}, ${userId || 'system'}, ${notifContent}, 'contract_signed', NOW())
        `;
      }

      // Si tout signé : mise à jour booking + emails
      if (allSigned) {
        // Met à jour le booking lié
        if (contract.booking_id) {
          await sql`
            UPDATE bookings SET
              contract_id     = ${contractId},
              contract_status = 'signed',
              event_date      = COALESCE(${contract.event_date || null}, event_date),
              amount          = COALESCE(${contract.cachet ? parseFloat(contract.cachet) : null}, amount),
              start_time      = COALESCE(${contract.start_time || null}, start_time),
              end_time        = COALESCE(${contract.end_time || null}, end_time),
              venue_location  = COALESCE(${contract.lieu || null}, venue_location),
              updated_at      = NOW()
            WHERE id = ${contract.booking_id}
          `.catch(() => {});
        }

        const convId = conversationId || contract.conversation_id;
        if (convId) {
          const [conv] = await sql`SELECT * FROM conversations WHERE id = ${convId}`.catch(() => []);
          if (conv) {
            const [dj]    = await sql`SELECT email, first_name FROM users WHERE id = ${conv.dj_id}`.catch(() => []);
            const [venue] = await sql`SELECT email, first_name FROM users WHERE id = ${conv.venue_id}`.catch(() => []);

            // Email "contrat signé" aux deux parties
            for (const party of [dj, venue].filter(Boolean)) {
              await fetch('https://cuedj.eu/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'contract_fully_signed',
                  email: party.email,
                  firstName: party.first_name,
                  contractId,
                  contractLink: `https://cuedj.eu/contract-view.html?id=${contractId}`,
                  downloadLink: `https://cuedj.eu/contract-view.html?id=${contractId}&download=true`,
                  signers: contract.signed_by,
                  dates:   contract.signed_at
                })
              }).catch(() => {});
            }

            // Email "payer maintenant" au venue
            if (venue) {
              await fetch('https://cuedj.eu/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'contract_signed_pay_now',
                  email: venue.email,
                  firstName: venue.first_name,
                  contractId,
                  cachet: contract.cachet,
                  djName: contract.dj_name,
                  eventDate: contract.event_date,
                  paymentLink: `https://cuedj.eu/dashboard-venue.html`
                })
              }).catch(() => {});
            }
          }
        }
      }

      return res.status(200).json({ success: true, allSigned, signaturesCount });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Action invalide' });
};

async function generateContractWithAI(contract) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Tu es un expert juridique spécialisé dans les contrats de prestation artistique en France.
Génère un contrat de prestation DJ professionnel et complet en français avec ces informations :

PRESTATAIRE (DJ) :
- Nom : ${contract.dj_legal_name || contract.dj_name}
- Adresse : ${contract.dj_address || 'Non renseignée'}
- Email : ${contract.dj_email}
- Téléphone : ${contract.dj_phone || 'Non renseigné'}
- Matériel apporté : ${contract.dj_equipment || 'Non renseigné'}
- Rider technique : ${contract.dj_rider || 'Non renseigné'}

CLIENT (VENUE) :
- Nom : ${contract.venue_legal_name || contract.venue_name}
- Adresse : ${contract.venue_address || 'Non renseignée'}
- Contact sur place : ${contract.venue_contact || 'Non renseigné'}
- Email : ${contract.venue_email}

PRESTATION :
- Date : ${contract.event_date}
- Lieu exact : ${contract.venue_location || 'Non renseigné'}
- Type d'événement : ${contract.event_type || 'Prestation DJ'}
- Programme horaire : ${contract.venue_schedule || 'Non renseigné'}
- Matériel fourni par le venue : ${contract.venue_equipment || 'Non renseigné'}
- Conditions particulières : ${contract.venue_conditions || 'Aucune'}
- Cachet total : ${contract.amount}€ TTC

Le contrat doit inclure :
1. Identification des parties
2. Objet du contrat
3. Conditions de la prestation
4. Rémunération et modalités de paiement
5. Obligations du prestataire
6. Obligations du client
7. Matériel et technique
8. Annulation et force majeure
9. Propriété intellectuelle
10. Règlement des litiges

Rédige un contrat professionnel, complet et juridiquement solide.`
        }],
        max_tokens: 3000,
        temperature: 0.3
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.log('Erreur génération IA:', err.message);
    return null;
  }
}

async function notifyBothParties(contract, status) {
  const to = [contract.dj_email, contract.venue_email].filter(Boolean);
  if (!to.length) return;
  const isReady = status === 'ready_to_sign';
  await resend.emails.send({
    from: 'CUE DJ <noreply@cuedj.eu>',
    to,
    subject: isReady ? '✅ Contrat prêt à signer — CUE' : '🎉 Contrat finalisé — CUE',
    html: `
      <div style="background:#080808; color:#ddd; font-family:Arial; padding:40px; max-width:600px; margin:auto;">
        <h2 style="color:#FFC300;">${isReady ? '✅ Contrat prêt à signer' : '🎉 Contrat finalisé !'}</h2>
        <p>${isReady
          ? 'Les deux parties ont complété le contrat. Vous pouvez maintenant le signer.'
          : 'Votre contrat a été finalisé et signé par les deux parties.'}</p>
        <a href="https://cuedj.eu/dashboard-dj.html"
           style="background:#FFC300; color:#000; padding:14px 32px; border-radius:8px;
                  text-decoration:none; font-weight:700; display:inline-block; margin-top:16px;">
          Voir le contrat →
        </a>
      </div>
    `
  }).catch(e => console.log('Email error:', e.message));
}

async function sendFinalContract(contract) {
  const to = [contract.dj_email, contract.venue_email].filter(Boolean);
  if (!to.length) return;
  await resend.emails.send({
    from: 'CUE DJ <noreply@cuedj.eu>',
    to,
    subject: '🎉 Contrat signé — ' + contract.event_date + ' — CUE',
    html: generateContractHTML(contract)
  }).catch(e => console.log('Email error:', e.message));
}

function generateContractHTML(c) {
  return `
    <div style="font-family:Arial; max-width:800px; margin:auto; padding:40px; color:#111;">
      <div style="text-align:center; border-bottom:3px solid #FFC300; padding-bottom:24px; margin-bottom:32px;">
        <h1 style="color:#FFC300; font-size:28px; margin:0;">CUE</h1>
        <h2 style="margin:8px 0 0;">CONTRAT DE PRESTATION DJ</h2>
        <div style="color:#666; margin-top:8px;">Référence : ${c.id}</div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-bottom:32px;">
        <div style="background:#f9f9f9; border-radius:12px; padding:20px;">
          <h3 style="color:#FFC300; margin:0 0 16px;">LE PRESTATAIRE (DJ)</h3>
          <div><strong>Nom légal :</strong> ${c.dj_legal_name || c.dj_name}</div>
          <div><strong>Adresse :</strong> ${c.dj_address || '—'}</div>
          <div><strong>Téléphone :</strong> ${c.dj_phone || '—'}</div>
          <div><strong>Email :</strong> ${c.dj_email}</div>
        </div>
        <div style="background:#f9f9f9; border-radius:12px; padding:20px;">
          <h3 style="color:#FFC300; margin:0 0 16px;">LE CLIENT (VENUE)</h3>
          <div><strong>Nom légal :</strong> ${c.venue_legal_name || c.venue_name}</div>
          <div><strong>Adresse :</strong> ${c.venue_address || '—'}</div>
          <div><strong>Téléphone :</strong> ${c.venue_phone || '—'}</div>
          <div><strong>Email :</strong> ${c.venue_email}</div>
        </div>
      </div>

      <div style="background:#f9f9f9; border-radius:12px; padding:20px; margin-bottom:24px;">
        <h3 style="color:#FFC300; margin:0 0 16px;">DÉTAILS DE LA PRESTATION</h3>
        <div><strong>Date :</strong> ${c.event_date}</div>
        <div><strong>Type d'événement :</strong> ${c.event_type}</div>
        <div><strong>Lieu :</strong> ${c.venue_location || '—'}</div>
        <div><strong>Programme :</strong> ${c.venue_schedule || '—'}</div>
        <div><strong>Cachet :</strong> <span style="color:#FFC300; font-weight:bold; font-size:18px;">${c.amount}€ TTC</span></div>
      </div>

      ${c.dj_equipment || c.dj_rider ? `
      <div style="background:#f9f9f9; border-radius:12px; padding:20px; margin-bottom:24px;">
        <h3 style="color:#FFC300; margin:0 0 16px;">TECHNIQUE DJ</h3>
        ${c.dj_equipment ? `<div><strong>Matériel apporté :</strong> ${c.dj_equipment}</div>` : ''}
        ${c.dj_rider ? `<div style="margin-top:8px;"><strong>Rider technique :</strong> ${c.dj_rider}</div>` : ''}
      </div>` : ''}

      ${c.venue_equipment ? `
      <div style="background:#f9f9f9; border-radius:12px; padding:20px; margin-bottom:24px;">
        <h3 style="color:#FFC300; margin:0 0 16px;">TECHNIQUE FOURNIE PAR LE VENUE</h3>
        <div>${c.venue_equipment}</div>
      </div>` : ''}

      ${c.venue_conditions ? `
      <div style="background:#f9f9f9; border-radius:12px; padding:20px; margin-bottom:24px;">
        <h3 style="color:#FFC300; margin:0 0 16px;">CONDITIONS PARTICULIÈRES</h3>
        <div>${c.venue_conditions}</div>
      </div>` : ''}

      <div style="background:#f9f9f9; border-radius:12px; padding:20px; margin-bottom:32px;">
        <h3 style="color:#FFC300; margin:0 0 16px;">SIGNATURES ÉLECTRONIQUES</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
          <div style="border:2px solid #00c864; border-radius:8px; padding:16px; text-align:center;">
            <div style="color:#00c864; font-weight:bold; font-size:18px;">✅ Signé</div>
            <div><strong>${c.dj_legal_name || c.dj_name}</strong></div>
            <div style="color:#666; font-size:12px;">${new Date(c.dj_signed_at).toLocaleString('fr-FR')}</div>
            <div style="color:#666; font-size:11px;">IP: ${c.dj_sign_ip}</div>
          </div>
          <div style="border:2px solid #00c864; border-radius:8px; padding:16px; text-align:center;">
            <div style="color:#00c864; font-weight:bold; font-size:18px;">✅ Signé</div>
            <div><strong>${c.venue_legal_name || c.venue_name}</strong></div>
            <div style="color:#666; font-size:12px;">${new Date(c.venue_signed_at).toLocaleString('fr-FR')}</div>
            <div style="color:#666; font-size:11px;">IP: ${c.venue_sign_ip}</div>
          </div>
        </div>
      </div>

      <div style="text-align:center; color:#666; font-size:12px; border-top:1px solid #eee; padding-top:20px;">
        Contrat généré via CUE DJ Platform — cuedj.eu<br>
        Ce document constitue un contrat légalement contraignant entre les parties.<br>
        Référence : ${c.id} — Finalisé le ${new Date(c.finalized_at).toLocaleString('fr-FR')}
      </div>
    </div>
  `;
}
