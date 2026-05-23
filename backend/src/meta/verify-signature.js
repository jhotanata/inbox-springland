// src/meta/verify-signature.js
// Valida assinatura HMAC SHA-256 dos webhooks da Meta

const crypto = require('crypto');
const config = require('./config');

function verificarAssinaturaMeta(req) {
  const assinatura = req.headers['x-hub-signature-256'];

  // Se não há secret configurado, aceita tudo (modo desenvolvimento)
  if (!config.META_APP_SECRET) {
    console.warn('⚠️  META_APP_SECRET não definido — assinatura não verificada');
    return true;
  }

  if (!assinatura) {
    console.warn('⚠️  Webhook recebido sem X-Hub-Signature-256');
    return false;
  }

  if (!req.rawBody) {
    console.warn('⚠️  rawBody não disponível — middleware não configurado corretamente');
    return false;
  }

  const esperado = 'sha256=' + crypto
    .createHmac('sha256', config.META_APP_SECRET)
    .update(req.rawBody)
    .digest('hex');

  try {
    // timingSafeEqual exige buffers do mesmo tamanho
    const bufRecebido = Buffer.from(assinatura);
    const bufEsperado = Buffer.from(esperado);

    if (bufRecebido.length !== bufEsperado.length) return false;

    return crypto.timingSafeEqual(bufRecebido, bufEsperado);
  } catch (err) {
    console.error('❌ Erro ao verificar assinatura:', err.message);
    return false;
  }
}

module.exports = { verificarAssinaturaMeta };
