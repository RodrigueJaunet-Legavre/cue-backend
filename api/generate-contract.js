const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const {
    djName, djAddress, djPhone, djEmail, djSiret,
    venueName, venueAddress, venuePhone, venueEmail, venueSiret,
    date, fee, start, end, type, details,
    // simplified fields from dashboard modal
    cachet, lieu, extra,
    bookingId, conversationId
  } = req.body;

  const effectiveFee = fee || cachet;
  const effectiveDate = date;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 3000,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert juridique spécialisé dans les contrats de prestation artistique en France. Tu génères des contrats professionnels complets en français.'
          },
          {
            role: 'user',
            content: `Génère un contrat professionnel de prestation DJ avec EXACTEMENT ces informations :

**PRESTATAIRE (DJ) :**
- Nom : ${djName}
${djAddress ? `- Adresse : ${djAddress}` : ''}
${djPhone ? `- Téléphone : ${djPhone}` : ''}
${djEmail ? `- Email : ${djEmail}` : ''}
${djSiret ? `- SIRET : ${djSiret}` : ''}

**CLIENT :**
- Nom : ${venueName}
${venueAddress ? `- Adresse : ${venueAddress}` : ''}
${venuePhone ? `- Téléphone : ${venuePhone}` : ''}
${venueEmail ? `- Email : ${venueEmail}` : ''}
${venueSiret ? `- SIRET : ${venueSiret}` : ''}

**ÉVÉNEMENT :**
- Type : ${type || 'Prestation DJ'}
- Date : ${effectiveDate ? new Date(effectiveDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'À définir'}
${start ? `- Début : ${start}` : ''}
${end ? `- Fin : ${end}` : ''}
- Lieu : ${lieu || venueAddress || 'À définir'}
- Cachet : ${effectiveFee}€ TTC
- Modalités de paiement : Paiement intégral de ${effectiveFee}€ via la plateforme CUE (cuedj.eu).
${details || extra ? `- Conditions particulières : ${details || extra}` : ''}

Le contrat doit avoir ces 10 sections numérotées :
1. PARTIES
2. OBJET DU CONTRAT
3. CONDITIONS DE LA PRESTATION
4. RÉMUNÉRATION ET MODALITÉS DE PAIEMENT
5. CONDITIONS D'ANNULATION
6. OBLIGATIONS DU PRESTATAIRE
7. OBLIGATIONS DU CLIENT
8. PROPRIÉTÉ INTELLECTUELLE
9. RESPONSABILITÉ
10. SIGNATURES`
          }
        ]
      })
    });

    const groqData = await response.json();
    if (!response.ok) return res.status(500).json({ error: groqData.error?.message || 'Erreur Groq' });

    const contractText = groqData.choices?.[0]?.message?.content;
    if (!contractText) throw new Error('Génération échouée');

    const contractId = 'CGEN-' + Date.now();

    let finalBookingId = bookingId || null;
    if (!finalBookingId && conversationId) {
      const [conv] = await sql`
        SELECT b.id FROM bookings b
        WHERE (b.dj_id || '_' || b.venue_id) = ${conversationId}
           OR (b.venue_id || '_' || b.dj_id) = ${conversationId}
        ORDER BY b.created_at DESC LIMIT 1
      `.catch(() => []);
      if (conv) finalBookingId = conv.id;
    }

    await sql`
      INSERT INTO generated_contracts (
        id, dj_name, venue_name, event_date, content,
        cachet, lieu, start_time, end_time, booking_id, conversation_id,
        created_at
      )
      VALUES (
        ${contractId}, ${djName || ''}, ${venueName || ''}, ${effectiveDate || null}, ${contractText},
        ${(effectiveFee)?.toString() || null}, ${lieu || venueAddress || null},
        ${start || null}, ${end || null},
        ${finalBookingId || null}, ${conversationId || null},
        NOW()
      )
    `;

    return res.status(200).json({
      contract: contractText,
      contractId,
      link: `https://cuedj.eu/contract-view.html?id=${contractId}`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
