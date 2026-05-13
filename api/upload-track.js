const { createClient } = require('@supabase/supabase-js');
const { formidable } = require('formidable');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: 60 * 1024 * 1024, keepExtensions: true });
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

    const file = Array.isArray(files.track) ? files.track[0] : files.track;
    if (!file) return res.status(400).json({ error: 'Fichier audio manquant' });

    const ext = path.extname(file.originalFilename || file.newFilename || '.mp3') || '.mp3';
    const filename = (file.originalFilename || file.newFilename || `track${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId}/${Date.now()}_${filename}`;
    const fileBuffer = fs.readFileSync(file.filepath);
    const mimeType = file.mimetype || (ext === '.wav' ? 'audio/wav' : 'audio/mpeg');

    const { data, error } = await supabase.storage
      .from('tracks')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    try { fs.unlinkSync(file.filepath); } catch (_) {}

    if (error) {
      console.error('[upload-track] Erreur Supabase:', error.message);
      return res.status(500).json({ error: error.message });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('tracks')
      .getPublicUrl(storagePath);

    return res.status(200).json({
      success: true,
      url: publicUrl,
      name: file.originalFilename || filename,
      path: storagePath
    });

  } catch (err) {
    console.error('[upload-track] Erreur handler:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
