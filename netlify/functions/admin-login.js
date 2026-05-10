exports.handler = async (event) => {
  console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL);
  console.log('Reçu email:', JSON.parse(event.body).email);

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
