const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { genre, minRating, verifiedOnly, sort, search, plan, city } = req.body;

  try {
    let djs = await sql`
      SELECT
        u.id, u.first_name, u.last_name, u.stage_name, u.email, u.user_type,
        u.plan, u.identity_status, u.description, u.genres,
        u.instagram, u.soundcloud, u.spotify, u.youtube,
        u.mix_url, u.tracks, u.picture, u.profile_complete, u.created_at,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.id) as total_reviews,
        COUNT(DISTINCT r.id) as review_count,
        COUNT(DISTINCT b.id) as booking_count
      FROM users u
      LEFT JOIN reviews r ON u.id = r.dj_id
      LEFT JOIN bookings b ON u.id = b.dj_id AND b.status = 'confirmed'
      WHERE u.user_type = 'dj' AND (u.suspended IS NULL OR u.suspended = false) AND u.profile_complete = true
      GROUP BY u.id
      ORDER BY avg_rating DESC
    `;

    if (genre) djs = djs.filter(dj => dj.genres?.includes(genre));
    if (plan) djs = djs.filter(dj => dj.plan === plan);
    if (city) djs = djs.filter(dj => dj.city && dj.city.toLowerCase().includes(city.toLowerCase()));
    if (minRating) djs = djs.filter(dj => parseFloat(dj.avg_rating) >= parseFloat(minRating));
    if (verifiedOnly === true || verifiedOnly === 'true') {
      djs = djs.filter(dj => dj.identity_status === 'verified');
    }
    if (search) {
      const q = search.toLowerCase();
      djs = djs.filter(dj =>
        (dj.stage_name || (dj.first_name + ' ' + dj.last_name)).toLowerCase().includes(q) ||
        dj.description?.toLowerCase().includes(q) ||
        dj.genres?.some(g => g.toLowerCase().includes(q))
      );
    }

    // Tri : Business en premier, puis Pro, puis Starter, puis par rating
    if (sort === 'reviews') djs.sort((a, b) => b.review_count - a.review_count);
    else if (sort === 'bookings') djs.sort((a, b) => b.booking_count - a.booking_count);
    else if (sort === 'newest') djs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else {
      const planOrder = { business: 0, founder: 0, pro: 1, starter: 2 };
      djs.sort((a, b) => {
        const planDiff = (planOrder[a.plan] ?? 2) - (planOrder[b.plan] ?? 2);
        if (planDiff !== 0) return planDiff;
        return (b.avg_rating || 0) - (a.avg_rating || 0);
      });
    }

    return res.status(200).json({ djs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
