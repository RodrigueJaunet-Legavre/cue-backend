exports.handler = async (event) => {
  const { djName, venue, date, start, end, fee, type, details } = JSON.parse(event.body);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert juridique spécialisé dans les contrats de prestation artistique en France. Tu génères des contrats professionnels, complets et juridiquement solides en français.'
          },
          {
            role: 'user',
            content: `Génère un contrat professionnel de prestation DJ avec ces informations :
- DJ (Prestataire) : ${djName}
- Venue / Client : ${venue}
- Type d'événement : ${type}
- Date : ${date}
- Horaires : ${start} → ${end}
- Cachet : ${fee}€ TTC
- Détails supplémentaires : ${details || 'Aucun'}

Le contrat doit inclure ces sections :
1. PARTIES (coordonnées DJ et Client)
2. OBJET DU CONTRAT
3. CONDITIONS DE LA PRESTATION (date, lieu, horaires, matériel)
4. RÉMUNÉRATION ET MODALITÉS DE PAIEMENT
5. CONDITIONS D'ANNULATION
6. OBLIGATIONS DU PRESTATAIRE
7. OBLIGATIONS DU CLIENT
8. PROPRIÉTÉ INTELLECTUELLE
9. RESPONSABILITÉ
10. SIGNATURES (avec espaces pour date et signature)`
          }
        ]
      })
    });

    const data = await response.json();
    console.log('Status Groq:', response.status);

    if (!response.ok) {
      console.log('Erreur Groq:', JSON.stringify(data));
      return { statusCode: 500, body: JSON.stringify({ error: data.error?.message || 'Erreur Groq' }) };
    }

    const contract = data.choices[0].message.content;
    return {
      statusCode: 200,
      body: JSON.stringify({ contract })
    };

  } catch (err) {
    console.log('ERREUR:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
