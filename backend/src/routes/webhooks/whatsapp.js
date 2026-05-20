const router = require('express').Router();
const crypto = require('crypto');
const db = require('../../db');

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
    console.log('[WH:WA] Webhook verificado com sucesso');
    return res.status(200).send(challenge);
  }
  console.warn('[WH:WA] Falha na verificação do webhook');
  res.sendStatus(403);
});

// POST — recebimento de mensagens
router.post('/', async (req, res) => {
  // 200 imediato — Meta desabilita webhooks que demoram ou retornam erro
  res.sendStatus(200);

  if (!verificarAssinatura(req)) {
    console.warn('[WH:WA] Assinatura inválida ou ausente — ignorado');
    return;
  }

  try {
    const changes = req.body?.entry?.[0]?.changes?.[0]?.value;
    if (!changes?.messages?.length) return; // status update, sem mensagem

    for (const msg of changes.messages) {
      const tipos = { text: 'texto', image: 'imagem', audio: 'audio' };
      const tipo = tipos[msg.type];
      if (!tipo) continue; // ignora tipos não suportados (vídeo, doc, etc.)

      const from = msg.from;
      const nome = changes.contacts?.[0]?.profile?.name || from;
      const conteudo = msg.text?.body || null;
      const midia_url = msg.image?.url || msg.audio?.url || null;

      const { rows: [contato] } = await db.query(
        `INSERT INTO contatos (canal, canal_user_id, nome, telefone, ultimo_contato)
         VALUES ('whatsapp', $1, $2, $1, NOW())
         ON CONFLICT (canal, canal_user_id)
         DO UPDATE SET nome = EXCLUDED.nome, ultimo_contato = NOW()
         RETURNING *`,
        [from, nome]
      );

      let { rows: [conversa] } = await db.query(
        `SELECT * FROM conversas
         WHERE contato_id = $1 AND canal = 'whatsapp' AND status = 'aberta'
         LIMIT 1`,
        [contato.id]
      );

      if (!conversa) {
        const { rows: [nova] } = await db.query(
          `INSERT INTO conversas (contato_id, marca, canal, status, nao_lidas)
           VALUES ($1, 'springland', 'whatsapp', 'aberta', 1) RETURNING *`,
          [contato.id]
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
        [conversa.id, conteudo, tipo, midia_url, msg.id]
      );

      req.io.emit('mensagem:nova', { conversa_id: conversa.id, mensagem, contato });
      console.log(`[WH:WA] Msg de ${from} salva → conversa #${conversa.id}`);
    }
  } catch (err) {
    console.error('[WH:WA] Erro ao processar mensagem:', err.message);
  }
});

module.exports = router;
