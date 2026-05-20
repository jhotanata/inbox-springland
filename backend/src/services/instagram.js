const axios = require('axios');

async function enviarInstagram(recipientId, texto) {
  const { data } = await axios.post(
    'https://graph.facebook.com/v19.0/me/messages',
    {
      recipient: { id: recipientId },
      message: { text: texto },
    },
    { headers: { Authorization: `Bearer ${process.env.INSTAGRAM_TOKEN}` } }
  );
  return data.message_id || null;
}

module.exports = { enviarInstagram };
