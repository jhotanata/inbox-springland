// src/meta/instagram.js
// Envio e recebimento via Instagram Messaging API

const axios  = require('axios');
const config = require('./config');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function detectarMarca(pageId) {
  for (const [chave, pagina] of Object.entries(config.PAGES)) {
    if (pagina.page_id === String(pageId)) return chave;
  }
  console.warn('⚠️  page_id desconhecido:', pageId, '— usando springland como fallback');
  return 'springland';
}

function pageTokenDaMarca(marca) {
  return config.PAGES[marca]?.page_access_token || null;
}

// ─── ENVIO ───────────────────────────────────────────────────────────────────

async function enviarMensagemInstagram(igUserId, texto, pageToken) {
  const url = `${config.GRAPH_BASE}/me/messages`;

  try {
    const response = await axios.post(url, {
      recipient:       { id: igUserId },
      message:         { text: texto },
      messaging_type:  'RESPONSE',
    }, {
      headers: {
        'Authorization': `Bearer ${pageToken}`,
        'Content-Type':  'application/json',
      },
    });

    const messageId = response.data.message_id;
    console.log('✅ Instagram enviado:', messageId, '→', igUserId);
    return messageId;

  } catch (err) {
    console.error('❌ Erro ao enviar Instagram:',
      err.response?.data || err.message);
    throw err;
  }
}

// ─── RECEBIMENTO (WEBHOOK) ────────────────────────────────────────────────────

function processarWebhookInstagram(payload, db, io) {
  let logId = null;
  try {
    const r = db.prepare(`
      INSERT INTO webhook_logs (canal, evento, payload, processado)
      VALUES ('instagram', 'message', ?, 0)
    `).run(JSON.stringify(payload));
    logId = r.lastInsertRowid;
  } catch (e) {
    console.error('❌ Erro ao salvar webhook_log:', e.message);
  }

  try {
    const entry = payload.entry?.[0];
    if (!entry) return;

    const pageId    = String(entry.id);
    const marca     = detectarMarca(pageId);
    const messaging = entry.messaging;
    if (!messaging || messaging.length === 0) return;

    for (const evento of messaging) {
      const senderId = evento.sender?.id;
      const texto    = evento.message?.text || '[mensagem sem texto]';
      const metaId   = evento.message?.mid  || null;

      // Ignorar echo (mensagens enviadas pela página)
      if (evento.message?.is_echo) continue;
      if (!senderId) continue;

      // ── UPSERT contato por instagram_id ──
      let contato = db.prepare(
        'SELECT * FROM contatos WHERE instagram_id = ?'
      ).get(senderId);

      if (!contato) {
        const r = db.prepare(`
          INSERT INTO contatos
            (nome, instagram_id, instagram_username, origem, marca, ultima_interacao)
          VALUES (?, ?, ?, 'instagram', ?, CURRENT_TIMESTAMP)
        `).run(senderId, senderId, senderId, marca);
        contato = db.prepare('SELECT * FROM contatos WHERE id = ?').get(r.lastInsertRowid);
      } else {
        db.prepare(
          'UPDATE contatos SET ultima_interacao = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(contato.id);
      }

      // ── Busca conversa aberta ou cria nova ──
      let conversa = db.prepare(`
        SELECT * FROM conversas
        WHERE contato_id = ? AND canal = 'instagram' AND status = 'aberta'
        ORDER BY criada_em DESC LIMIT 1
      `).get(contato.id);

      if (!conversa) {
        const r = db.prepare(`
          INSERT INTO conversas (contato_id, canal, marca, status)
          VALUES (?, 'instagram', ?, 'aberta')
        `).run(contato.id, marca);
        conversa = db.prepare('SELECT * FROM conversas WHERE id = ?').get(r.lastInsertRowid);
      }

      // ── Insere mensagem ──
      const msgResult = db.prepare(`
        INSERT INTO mensagens
          (conversa_id, direcao, conteudo, meta_message_id, status)
        VALUES (?, 'recebida', ?, ?, 'recebida')
      `).run(conversa.id, texto, metaId);

      db.prepare(
        'UPDATE conversas SET atualizada_em = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(conversa.id);

      if (logId) {
        db.prepare('UPDATE webhook_logs SET processado = 1 WHERE id = ?').run(logId);
      }

      const mensagem = db.prepare(
        'SELECT * FROM mensagens WHERE id = ?'
      ).get(msgResult.lastInsertRowid);

      io.emit('nova_mensagem', { conversa_id: conversa.id, mensagem });
      io.emit('nova_conversa', { conversa_id: conversa.id, contato: senderId, mensagem: texto });

      console.log(`📸 Instagram recebido de ${senderId} (${marca}): ${texto}`);
    }

  } catch (err) {
    console.error('❌ Erro ao processar webhook Instagram:', err);
    try {
      if (logId) {
        db.prepare(
          'UPDATE webhook_logs SET erro = ? WHERE id = ?'
        ).run(err.message, logId);
      }
    } catch (_) {}
  }
}

module.exports = {
  enviarMensagemInstagram,
  processarWebhookInstagram,
  detectarMarca,
  pageTokenDaMarca,
};
