module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const {
    djName, djAddress, djPhone, djEmail, djSiret,
    venueName, venueAddress, venuePhone, venueEmail, venueSiret,
    date, fee, start, end, type, acompte, details
  } = req.body;

  const acompteText = acompte > 0
    ? `Un acompte de ${acompte}% (${Math.round(fee * acompte / 100)}€) sera versé à la signature du contrat. Le solde de ${Math.round(fee * (100 - acompte) / 100)}€ sera réglé le soir de la prestation.`
    : `Le paiement intégral de ${fee}€ sera effectué le soir de la prestation.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2500,
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
- Adresse : ${djAddress || 'Non renseignée'}
- Téléphone : ${djPhone || 'Non renseigné'}
- Email : ${djEmail || 'Non renseigné'}
${djSiret ? `- SIRET : ${djSiret}` : ''}

**CLIENT :**
- Nom : ${venueName}
- Adresse : ${venueAddress || 'Non renseignée'}
- Téléphone : ${venuePhone || 'Non renseigné'}
- Email : ${venueEmail || 'Non renseigné'}
${venueSiret ? `- SIRET : ${venueSiret}` : ''}

**ÉVÉNEMENT :**
- Type : ${type}
- Date : ${new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Horaires : ${start} → ${end}
- Cachet : ${fee}€ TTC
- Paiement : ${acompteText}
- Détails : ${details || 'Aucun détail supplémentaire'}

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

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Erreur Groq' });
    return res.status(200).json({ contract: data.choices[0].message.content });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
