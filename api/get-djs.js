const postgres = require('postgres');
const sql = postgres(process.env.NETLIFY_DATABASE_URL, { ssl: 'require' });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { genre, minRating, verifiedOnly, sort, search } = req.body;

  try {
    let djs = await sql`
      SELECT
        u.id, u.first_name, u.last_name, u.email, u.user_type,
        u.plan, u.identity_status, u.description, u.genres,
        u.instagram, u.soundcloud, u.spotify, u.youtube,
        u.mix_url, u.tracks, u.picture, u.profile_complete, u.created_at,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(r.id) as review_count,
        COUNT(b.id) as booking_count
      FROM users u
      LEFT JOIN reviews r ON u.id = r.dj_id
      LEFT JOIN bookings b ON u.id = b.dj_id AND b.status = 'confirmed'
      WHERE u.user_type = 'dj' AND u.suspended = false AND u.profile_complete = true
      GROUP BY u.id
      ORDER BY avg_rating DESC
    `;

    if (genre) djs = djs.filter(dj => dj.genres?.includes(genre));
    if (minRating) djs = djs.filter(dj => parseFloat(dj.avg_rating) >= parseFloat(minRating));
    if (verifiedOnly) djs = djs.filter(dj => dj.identity_status === 'verified');
    if (search) {
      const q = search.toLowerCase();
      djs = djs.filter(dj =>
        (dj.first_name + ' ' + dj.last_name).toLowerCase().includes(q) ||
        dj.description?.toLowerCase().includes(q) ||
        dj.genres?.some(g => g.toLowerCase().includes(q))
      );
    }

    if (sort === 'reviews') djs.sort((a, b) => b.review_count - a.review_count);
    else if (sort === 'bookings') djs.sort((a, b) => b.booking_count - a.booking_count);
    else if (sort === 'newest') djs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({ djs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
