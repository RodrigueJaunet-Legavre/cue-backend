exports.handler = async (event) => {
  const { djName, venue, date, start, end, fee, type, details } = JSON.parse(event.body);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Génère un contrat professionnel de prestation DJ en français avec ces informations :
- DJ : ${djName}
- Venue / Client : ${venue}
- Type d'événement : ${type}
- Date : ${date}
- Horaires : ${start} → ${end}
- Cachet : ${fee}€
- Détails : ${details || 'Aucun détail supplémentaire'}

Le contrat doit inclure : les parties, l'objet, les conditions de prestation, le paiement, les annulations, la technique, les signatures. Style professionnel et juridiquement solide.`
        }]
      })
    });

    const data = await response.json();
    const contract = data.content[0].text;

    return {
      statusCode: 200,
      body: JSON.stringify({ contract })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
