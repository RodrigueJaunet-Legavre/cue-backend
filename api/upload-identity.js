const { createClient } = require('@supabase/supabase-js');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { fields, files } = await parseForm(req);

    const userId = Array.isArray(fields.userId) ? fields.userId[0] : fields.userId;
    if (!userId) return res.status(400).json({ error: 'userId manquant' });

    const results = {};

    for (const [fieldName, fileArray] of Object.entries(files)) {
      const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;
      if (!file) continue;

      const ext = path.extname(file.originalFilename || file.newFilename || '.jpg') || '.jpg';
      const storagePath = `${userId}/${fieldName}${ext}`;
      const fileBuffer = fs.readFileSync(file.filepath);

      const { data, error } = await supabase.storage
        .from('identity-docs')
        .upload(storagePath, fileBuffer, {
          contentType: file.mimetype || 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error(`[upload-identity] Erreur upload ${fieldName}:`, error.message);
        return res.status(500).json({ error: `Erreur upload ${fieldName}`, details: error.message });
      }

      results[fieldName] = storagePath;

      try { fs.unlinkSync(file.filepath); } catch (_) {}
    }

    // Met à jour la DB
    const selfieUrl = results.selfie
      ? `${process.env.SUPABASE_URL}/storage/v1/object/identity-docs/${results.selfie}`
      : null;
    const docUrl = results.identity_card
      ? `${process.env.SUPABASE_URL}/storage/v1/object/identity-docs/${results.identity_card}`
      : null;

    if (selfieUrl && docUrl) {
      await sql`
        INSERT INTO identity_documents (id, user_id, selfie_url, document_url, status, submitted_at)
        VALUES (${Date.now().toString()}, ${userId}, ${selfieUrl}, ${docUrl}, 'pending', NOW())
        ON CONFLICT (user_id) DO UPDATE SET selfie_url = ${selfieUrl}, document_url = ${docUrl}, status = 'pending', submitted_at = NOW()
      `;
    }
    await sql`UPDATE users SET identity_status = 'pending' WHERE id = ${userId}`;

    return res.status(200).json({ success: true, paths: results });
  } catch (err) {
    console.error('[upload-identity] Erreur handler:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
