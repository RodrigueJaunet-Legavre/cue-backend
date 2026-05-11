async function getSignedUrl(supabaseUrl, supabaseKey, userId, fileType) {
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const path = `identity-docs/${userId}/${fileType}.${ext}`;
    const res = await fetch(`${supabaseUrl}/storage/v1/object/sign/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: 3600 })
    });
    const data = await res.json();
    if (data.signedURL) return `${supabaseUrl}/storage/v1${data.signedURL}`;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { adminSecret, userId } = req.body;
  if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Non autorisé' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  try {
    const [selfieUrl, documentUrl] = await Promise.all([
      getSignedUrl(supabaseUrl, supabaseKey, userId, 'selfie'),
      getSignedUrl(supabaseUrl, supabaseKey, userId, 'document')
    ]);
    return res.status(200).json({ selfieUrl, documentUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
