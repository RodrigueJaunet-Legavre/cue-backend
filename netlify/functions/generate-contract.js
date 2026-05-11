exports.handler = async (event) => {
  console.log('Fonction appelée');
  console.log('Body:', event.body);
  console.log('ANTHROPIC_API_KEY présent:', !!process.env.ANTHROPIC_API_KEY);

  const { djName, venue, date, start, end, fee, type, details } = JSON.parse(event.body);
  console.log('Données reçues:', { djName, venue, date, fee });

  try {
    console.log('Appel API Anthropic...');
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
          content: `Génère un contrat professionnel DJ en français.
DJ: ${djName}, Venue: ${venue}, Date: ${date}, Cachet: ${fee}€`
        }]
      })
    });

    console.log('Status Anthropic:', response.status);
    const data = await response.json();
    console.log('Réponse Anthropic:', JSON.stringify(data).slice(0, 200));

    if (data.error) {
      return { statusCode: 500, body: JSON.stringify({ error: data.error.message }) };
    }

    const contract = data.content[0].text;
    return { statusCode: 200, body: JSON.stringify({ contract }) };

  } catch (err) {
    console.log('ERREUR:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
