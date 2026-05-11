const postgres = require('postgres');

exports.handler = async (event) => {
  const { adminSecret, userId } = JSON.parse(event.body);

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, body: 'Non autorisé' };
  }

  const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  try {
    const [doc] = await sql`
      SELECT * FROM identity_documents WHERE user_id = ${userId}
      ORDER BY submitted_at DESC LIMIT 1
    `;

    if (!doc) {
      return { statusCode: 200, body: JSON.stringify({ selfieUrl: null, documentUrl: null }) };
    }

    // Détermine les extensions depuis les URLs stockées
    const selfieExt = doc.selfie_url?.endsWith('.png') ? 'png' : 'jpg';
    const docExt = doc.document_url?.endsWith('.png') ? 'png' : 'jpg';

    // Génère des URLs signées (valides 1h)
    const [signSelfie, signDoc] = await Promise.all([
      fetch(`${supabaseUrl}/storage/v1/object/sign/identity-docs/${userId}/selfie.${selfieExt}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expiresIn: 3600 })
      }),
      fetch(`${supabaseUrl}/storage/v1/object/sign/identity-docs/${userId}/document.${docExt}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expiresIn: 3600 })
      })
    ]);

    const selfieData = await signSelfie.json();
    const docData = await signDoc.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        selfieUrl: selfieData.signedURL ? `${supabaseUrl}/storage/v1${selfieData.signedURL}` : null,
        documentUrl: docData.signedURL ? `${supabaseUrl}/storage/v1${docData.signedURL}` : null
      })
    };
  } catch (err) {
    console.log('Erreur admin-get-docs:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
