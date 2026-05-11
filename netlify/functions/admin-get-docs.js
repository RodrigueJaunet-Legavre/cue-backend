const postgres = require('postgres');

async function getSignedUrl(supabaseUrl, supabaseKey, userId, fileType) {
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const path = `identity-docs/${userId}/${fileType}.${ext}`;
    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${path}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expiresIn: 3600 })
      }
    );
    const data = await res.json();
    if (data.signedURL) {
      return `${supabaseUrl}/storage/v1${data.signedURL}`;
    }
  }
  return null;
}

exports.handler = async (event) => {
  const { adminSecret, userId } = JSON.parse(event.body);

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, body: 'Non autorisé' };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  console.log('SUPABASE_URL présent:', !!supabaseUrl);
  console.log('SUPABASE_SERVICE_KEY présent:', !!supabaseKey);
  console.log('userId:', userId);

  try {
    const [selfieUrl, documentUrl] = await Promise.all([
      getSignedUrl(supabaseUrl, supabaseKey, userId, 'selfie'),
      getSignedUrl(supabaseUrl, supabaseKey, userId, 'document')
    ]);

    console.log('selfieUrl:', selfieUrl);
    console.log('documentUrl:', documentUrl);

    return {
      statusCode: 200,
      body: JSON.stringify({ selfieUrl, documentUrl })
    };
  } catch (err) {
    console.log('Erreur:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
