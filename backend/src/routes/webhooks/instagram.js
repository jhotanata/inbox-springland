const router = require('express').Router();
const crypto = require('crypto');
const db = require('../../db');

const MARCAS = () => ({
  [process.env.IG_SPRINGLAND_ID]: 'springland',
  [process.env.IG_SEURANGO_ID]: 'seurango',
});

function verificarAssinatura(req) {
  const assinatura = req.headers['x-hub-signature-256'];
  if (!assinatura) return false;

  const hmac = crypto
    .createHmac('sha256', process.env.FB_APP_SECRET)
    .update(req.rawBody)
    .digest('hex');

  const esperado = Buffer.from(`sha256=${hmac}`);
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length) return false;
  return crypto.timingSafeEqual(esperado, recebido);
}

// GET — verificação do webhook na Meta
router.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('[WH:IG] Webhook verificado com sucesso');
    return res.status(200).send(challenge);
  }
  console.warn('[WH:IG] Falha na verificação do webhook');
  res.sendStatus(403);
});

// POST — recebimento de mensagens
router.post('/', async (req, res) => {
  res.sendStatus(200);

  if (!verificarAssinatura(req)) {
    console.warn('[WH:IG] Assinatura inválida ou ausente — ignorado');
    return;
  }

  try {
    const entry = req.body?.entry?.[0];
    const messaging = entry?.messaging?.[0];
    if (!messaging?.message) return;

    const msg = messaging.message;
    const senderId = messaging.sender.id;
    const recipientId = messaging.recipient.id;

    const marca = MARCAS()[recipientId] || 'springland';
    console.log(`[WH:IG] Msg de ${senderId} → conta ${recipientId} (${marca})`);

    const conteudo = msg.text || null;
    const anexo = msg.attachments?.[0];
    const tipo = !anexo ? 'texto' : anexo.type === 'image' ? 'imagem' : 'audio';
    const midia_url = anexo?.payload?.url || null;

    const { rows: [contato] } = await db.query(
      `INSERT INTO contatos (canal, canal_user_id, nome, ultimo_contato)
       VALUES ('instagram', $1, $1, NOW())
       ON CONFLICT (canal, canal_user_id)
       DO UPDATE SET ultimo_contato = NOW()
       RETURNING *`,
      [senderId]
    );

    let { rows: [conversa] } = await db.query(
      `SELECT * FROM conversas
       WHERE contato_id = $1 AND canal = 'instagram' AND marca = $2 AND status = 'aberta'
       LIMIT 1`,
      [contato.id, marca]
    );

    if (!conversa) {
      const { rows: [nova] } = await db.query(
        `INSERT INTO conversas (contato_id, marca, canal, status, nao_lidas)
         VALUES ($1, $2, 'instagram', 'aberta', 1) RETURNING *`,
        [contato.id, marca]
      );
      conversa = nova;
    } else {
      await db.query(
        'UPDATE conversas SET nao_lidas = nao_lidas + 1, atualizada_em = NOW() WHERE id = $1',
        [conversa.id]
      );
    }

    const { rows: [mensagem] } = await db.query(
      `INSERT INTO mensagens (conversa_id, direcao, conteudo, tipo, midia_url, meta_message_id)
       VALUES ($1, 'entrada', $2, $3, $4, $5) RETURNING *`,
      [conversa.id, conteudo, tipo, midia_url, msg.mid]
    );

    req.io.emit('mensagem:nova', { conversa_id: conversa.id, mensagem, contato, marca });
    console.log(`[WH:IG] Msg de ${senderId} salva → conversa #${conversa.id} (${marca})`);
  } catch (err) {
    console.error('[WH:IG] Erro ao processar mensagem:', err.message);
  }
});

module.exports = router;
