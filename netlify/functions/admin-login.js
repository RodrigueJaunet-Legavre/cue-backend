exports.handler = async (event) => {
  const { email, password } = JSON.parse(event.body);

  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return {
      statusCode: 200,
      body: JSON.stringify({ secret: process.env.ADMIN_SECRET })
    };
  }

  return { statusCode: 401, body: 'Non autorisé' };
};
