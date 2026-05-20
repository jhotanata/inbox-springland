const axios = require('axios');

async function enviarWhatsApp(to, texto) {
  const { data } = await axios.post(
    `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: texto },
    },
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
  );
  return data.messages?.[0]?.id || null;
}

module.exports = { enviarWhatsApp };
