const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  const { adminSecret } = JSON.parse(event.body);

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, body: 'Non autorisé' };
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  const [djs] = await sql`SELECT COUNT(*) FROM users WHERE user_type = 'dj'`;
  const [venues] = await sql`SELECT COUNT(*) FROM users WHERE user_type = 'venue'`;
  const [bookingsMonth] = await sql`SELECT COUNT(*) FROM bookings WHERE created_at >= date_trunc('month', NOW())`;
  const [bookingsTotal] = await sql`SELECT COUNT(*) FROM bookings`;
  const [revenueWeek] = await sql`SELECT COALESCE(SUM(amount),0) as total FROM payouts WHERE created_at >= NOW() - INTERVAL '7 days'`;
  const [revenueMonth] = await sql`SELECT COALESCE(SUM(amount),0) as total FROM payouts WHERE created_at >= date_trunc('month', NOW())`;
  const [revenueTotal] = await sql`SELECT COALESCE(SUM(amount),0) as total FROM payouts`;
  const [pendingVerif] = await sql`SELECT COUNT(*) FROM users WHERE identity_status = 'pending'`;
  const [openReports] = await sql`SELECT COUNT(*) FROM reports WHERE status = 'open'`;

  return {
    statusCode: 200,
    body: JSON.stringify({
      djs: djs.count,
      venues: venues.count,
      bookingsMonth: bookingsMonth.count,
      bookingsTotal: bookingsTotal.count,
      revenueWeek: revenueWeek.total,
      revenueMonth: revenueMonth.total,
      revenueTotal: revenueTotal.total,
      pendingVerif: pendingVerif.count,
      openReports: openReports.count
    })
  };
};
