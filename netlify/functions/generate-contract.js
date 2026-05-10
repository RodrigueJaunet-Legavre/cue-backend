const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  const { djName, venue, date, start, end, fee, type, details } = JSON.parse(event.body);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
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
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ contract: message.content[0].text })
  };
};
