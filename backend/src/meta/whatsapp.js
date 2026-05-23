// src/meta/whatsapp.js
// Envio e recebimento via WhatsApp Cloud API

const axios  = require('axios');
const config = require('./config');

// ─── ENVIO ───────────────────────────────────────────────────────────────────

async function enviarMensagemWhatsApp(numero, texto) {
  const url = `${config.GRAPH_BASE}/${config.WHATSAPP_PHONE_ID}/messages`;

  try {
    const response = await axios.post(url, {
      messaging_product: 'whatsapp',
      to:   numero,
      type: 'text',
      text: { body: texto },
    }, {
      headers: {
        'Authorization': `Bearer ${config.WHATSAPP_TOKEN}`,
        'Content-Type':  'application/json',
      },
    });

    const messageId = response.data.messages[0].id;
    console.log('✅ WhatsApp enviado:', messageId, '→', numero);
    return messageId;

  } catch (err) {
    console.error('❌ Erro ao enviar WhatsApp:',
      err.response?.data || err.message);
    throw err;
  }
}

// ─── RECEBIMENTO (WEBHOOK) ────────────────────────────────────────────────────

function processarWebhookWhatsApp(payload, db, io) {
  // Log bruto — útil para debug
  let logId = null;
  try {
    const r = db.prepare(`
      INSERT INTO webhook_logs (canal, evento, payload, processado)
      VALUES ('whatsapp', 'message', ?, 0)
    `).run(JSON.stringify(payload));
    logId = r.lastInsertRowid;
  } catch (e) {
    console.error('❌ Erro ao salvar webhook_log:', e.message);
  }

  try {
    const entry = payload.entry?.[0];
    if (!entry) return;

    const change = entry.changes?.[0];
    if (!change || change.field !== 'messages') return;

    const value    = change.value;
    const messages = value.messages;
    if (!messages || messages.length === 0) return;

    for (const msg of messages) {
      const telefone    = msg.from;
      const metaId      = msg.id;
      const texto       = msg.text?.body || '[mensagem sem texto]';
      const nomeContato = value.contacts?.[0]?.profile?.name || telefone;

      // ── UPSERT contato por whatsapp_phone ──
      let contato = db.prepare(
        'SELECT * FROM contatos WHERE whatsapp_phone = ?'
      ).get(telefone);

      if (!contato) {
        const r = db.prepare(`
          INSERT INTO contatos
            (nome, whatsapp_phone, telefone, origem, marca, ultima_interacao)
          VALUES (?, ?, ?, 'whatsapp', 'springland', CURRENT_TIMESTAMP)
        `).run(nomeContato, telefone, telefone);
        contato = db.prepare('SELECT * FROM contatos WHERE id = ?').get(r.lastInsertRowid);
      } else {
        db.prepare(
          'UPDATE contatos SET ultima_interacao = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(contato.id);
      }

      // ── Busca conversa aberta ou cria nova ──
      let conversa = db.prepare(`
        SELECT * FROM conversas
        WHERE contato_id = ? AND canal = 'whatsapp' AND status = 'aberta'
        ORDER BY criada_em DESC LIMIT 1
      `).get(contato.id);

      if (!conversa) {
        const r = db.prepare(`
          INSERT INTO conversas (contato_id, canal, marca, status)
          VALUES (?, 'whatsapp', 'springland', 'aberta')
        `).run(contato.id);
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

      // ── Marca log como processado ──
      if (logId) {
        db.prepare('UPDATE webhook_logs SET processado = 1 WHERE id = ?').run(logId);
      }

      const mensagem = db.prepare(
        'SELECT * FROM mensagens WHERE id = ?'
      ).get(msgResult.lastInsertRowid);

      // ── Emite para o frontend via Socket.IO ──
      io.emit('nova_mensagem',  { conversa_id: conversa.id, mensagem });
      io.emit('nova_conversa',  { conversa_id: conversa.id, contato: nomeContato, mensagem: texto });

      console.log(`📩 WhatsApp recebido de ${nomeContato} (${telefone}): ${texto}`);
    }

  } catch (err) {
    console.error('❌ Erro ao processar webhook WhatsApp:', err);
    try {
      if (logId) {
        db.prepare(
          'UPDATE webhook_logs SET erro = ? WHERE id = ?'
        ).run(err.message, logId);
      }
    } catch (_) {}
  }
}

module.exports = { enviarMensagemWhatsApp, processarWebhookWhatsApp };
