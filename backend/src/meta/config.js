// src/meta/config.js
// Configuração central das integrações Meta (WhatsApp + Instagram)

module.exports = {
  WHATSAPP_TOKEN:       process.env.WHATSAPP_TOKEN,
  WHATSAPP_PHONE_ID:    process.env.WHATSAPP_PHONE_ID,
  WHATSAPP_BUSINESS_ID: process.env.WHATSAPP_BUSINESS_ID,
  META_APP_SECRET:      process.env.FB_APP_SECRET,
  META_VERIFY_TOKEN:    process.env.META_VERIFY_TOKEN || 'springland_invasao_2026_xyz',

  PAGES: {
    springland: {
      page_id:           '105694464904908',
      page_access_token: process.env.PAGE_TOKEN_SPRINGLAND,
      instagram_id:      process.env.IG_ID_SPRINGLAND,
    },
    seurango: {
      page_id:           '104568198712127',
      page_access_token: process.env.PAGE_TOKEN_SEURANGO,
      instagram_id:      process.env.IG_ID_SEURANGO,
    },
  },

  GRAPH_API_VERSION: 'v21.0',
  GRAPH_BASE:        'https://graph.facebook.com/v21.0',
};
