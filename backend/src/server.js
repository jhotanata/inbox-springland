// src/server.js
// Servidor principal do Inbox Springland - v0.4.0

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const http    = require('http');
const { Server } = require('socket.io');

const db = require('./db/init');

// Rodar seed automaticamente se banco estiver vazio
const totalAtendentes = db.prepare('SELECT COUNT(*) as t FROM atendentes').get().t;
if (totalAtendentes === 0) {
  console.log('⚙️  Banco vazio. Rodando seed automático...');
  require('./db/seed');
}

// Módulos Meta (carregados após dotenv)
const metaConfig          = require('./meta/config');
const whatsapp            = require('./meta/whatsapp');
const instagram           = require('./meta/instagram');
const { verificarAssinaturaMeta } = require('./meta/verify-signature');

const app    = express();
const server = http.createServer(app);

// CORS liberado para o frontend
const ALLOWED_ORIGINS = [
  'https://app.chatgruporango.tech',
  'https://chat.chatgruporango.tech',
  'http://localhost:3000',
  'http://localhost:3001',
];

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true }
});

const PORT = process.env.PORT || 3001;

// ============ MIDDLEWARES ============

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

// IMPORTANTE: captura rawBody para os webhooks da Meta ANTES do express.json() global
// Isso permite verificar a assinatura HMAC-SHA256
app.use('/webhook', express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

// JSON para todas as outras rotas
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ HEALTH ============

app.get('/health', (req, res) => {
  res.json({
    ok:       true,
    ts:       new Date().toISOString(),
    versao:   '0.4.0',
    banco:    'sqlite',
    atendentes: db.prepare('SELECT COUNT(*) as t FROM atendentes').get().t,
    conversas:  db.prepare('SELECT COUNT(*) as t FROM conversas').get().t,
    mensagens:  db.prepare('SELECT COUNT(*) as t FROM mensagens').get().t,
  });
});

// ============ LOGIN ============

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha obrigatórios' });
  }

  const atendente = db.prepare(`
    SELECT id, nome, email, role, ativo
    FROM atendentes
    WHERE email = ? AND senha = ? AND ativo = 1
  `).get(email, senha);

  if (!atendente) {
    return res.status(401).json({ erro: 'Email ou senha incorretos' });
  }

  const token = Buffer.from(`${atendente.id}:${Date.now()}`).toString('base64');

  res.json({
    ok: true,
    token,
    atendente: {
      id:    atendente.id,
      nome:  atendente.nome,
      email: atendente.email,
      role:  atendente.role,
    }
  });
});

// ============ ATENDENTES ============

app.get('/api/atendentes', (req, res) => {
  const rows = db.prepare(`
    SELECT id, nome, email, role, ativo, criado_em
    FROM atendentes ORDER BY id
  `).all();
  res.json(rows);
});

// ============ STATS ============

app.get('/api/stats', (req, res) => {
  res.json({
    atendentes:       db.prepare('SELECT COUNT(*) as t FROM atendentes WHERE ativo = 1').get().t,
    contatos:         db.prepare('SELECT COUNT(*) as t FROM contatos').get().t,
    conversas_abertas: db.prepare("SELECT COUNT(*) as t FROM conversas WHERE status = 'aberta'").get().t,
    conversas_total:  db.prepare('SELECT COUNT(*) as t FROM conversas').get().t,
    mensagens_total:  db.prepare('SELECT COUNT(*) as t FROM mensagens').get().t,
  });
});

// ============ CONVERSAS ============

app.get('/api/conversas', (req, res) => {
  const status = req.query.status || 'aberta';

  const conversas = db.prepare(`
    SELECT
      c.id, c.canal, c.marca, c.status, c.atendente_id,
      c.criada_em, c.atualizada_em,
      ct.nome             as contato_nome,
      ct.telefone         as contato_telefone,
      ct.instagram_id     as contato_instagram,
      ct.whatsapp_phone   as contato_whatsapp,
      a.nome              as atendente_nome,
      (SELECT conteudo  FROM mensagens WHERE conversa_id = c.id ORDER BY enviada_em DESC LIMIT 1) as ultima_mensagem,
      (SELECT enviada_em FROM mensagens WHERE conversa_id = c.id ORDER BY enviada_em DESC LIMIT 1) as ultima_mensagem_em,
      (SELECT COUNT(*)  FROM mensagens WHERE conversa_id = c.id AND direcao = 'recebida')          as nao_lidas
    FROM conversas c
    LEFT JOIN contatos   ct ON ct.id = c.contato_id
    LEFT JOIN atendentes a  ON a.id  = c.atendente_id
    WHERE c.status = ?
    ORDER BY c.atualizada_em DESC
    LIMIT 100
  `).all(status);

  res.json(conversas);
});

app.get('/api/conversas/:id', (req, res) => {
  const id = parseInt(req.params.id);

  const conversa = db.prepare(`
    SELECT
      c.*,
      ct.nome              as contato_nome,
      ct.telefone          as contato_telefone,
      ct.instagram_id      as contato_instagram,
      ct.whatsapp_phone    as contato_whatsapp,
      ct.origem            as contato_origem,
      a.nome               as atendente_nome
    FROM conversas c
    LEFT JOIN contatos   ct ON ct.id = c.contato_id
    LEFT JOIN atendentes a  ON a.id  = c.atendente_id
    WHERE c.id = ?
  `).get(id);

  if (!conversa) return res.status(404).json({ erro: 'Conversa não encontrada' });

  const mensagens = db.prepare(`
    SELECT id, direcao, conteudo, tipo, meta_message_id, status, enviada_em
    FROM mensagens
    WHERE conversa_id = ?
    ORDER BY enviada_em ASC
  `).all(id);

  res.json({ conversa, mensagens });
});

// Enviar mensagem (com integração Meta)
app.post('/api/conversas/:id/mensagens', async (req, res) => {
  const id = parseInt(req.params.id);
  const { conteudo, atendente_id } = req.body || {};

  if (!conteudo) return res.status(400).json({ erro: 'Conteúdo obrigatório' });

  // Busca conversa + contato em um único join
  const conversa = db.prepare(`
    SELECT c.*, ct.whatsapp_phone, ct.instagram_id, ct.marca as contato_marca
    FROM conversas c
    LEFT JOIN contatos ct ON ct.id = c.contato_id
    WHERE c.id = ?
  `).get(id);

  if (!conversa) return res.status(404).json({ erro: 'Conversa não encontrada' });

  // Insere a mensagem no banco com status inicial 'enviando'
  const result = db.prepare(`
    INSERT INTO mensagens (conversa_id, direcao, conteudo, status)
    VALUES (?, 'enviada', ?, 'enviando')
  `).run(id, conteudo);

  const msgId = result.lastInsertRowid;

  db.prepare(`
    UPDATE conversas
    SET atualizada_em = CURRENT_TIMESTAMP,
        atendente_id  = COALESCE(?, atendente_id)
    WHERE id = ?
  `).run(atendente_id || null, id);

  // Tenta enviar via Meta (não bloqueia a resposta)
  let metaMessageId = null;
  let statusFinal   = 'enviada';

  try {
    if (conversa.canal === 'whatsapp' && conversa.whatsapp_phone && metaConfig.WHATSAPP_TOKEN) {
      metaMessageId = await whatsapp.enviarMensagemWhatsApp(conversa.whatsapp_phone, conteudo);

    } else if (conversa.canal === 'instagram' && conversa.instagram_id) {
      const marca      = conversa.marca || conversa.contato_marca || 'springland';
      const pageToken  = instagram.pageTokenDaMarca(marca);
      if (pageToken) {
        metaMessageId = await instagram.enviarMensagemInstagram(
          conversa.instagram_id, conteudo, pageToken
        );
      } else {
        console.warn('⚠️  page_token não configurado para marca:', marca);
      }
    }
  } catch (err) {
    console.error('❌ Falha ao enviar via Meta API — mensagem salva no banco:', err.message);
    statusFinal = 'erro_envio';
  }

  // Atualiza status e meta_message_id da mensagem
  db.prepare(`
    UPDATE mensagens
    SET status = ?, meta_message_id = COALESCE(?, meta_message_id)
    WHERE id = ?
  `).run(statusFinal, metaMessageId, msgId);

  const mensagem = db.prepare(`
    SELECT id, direcao, conteudo, tipo, meta_message_id, status, enviada_em
    FROM mensagens WHERE id = ?
  `).get(msgId);

  io.emit('nova_mensagem', { conversa_id: id, mensagem });

  res.json({ ok: true, mensagem });
});

// Atribuir atendente
app.put('/api/conversas/:id/atribuir', (req, res) => {
  const id = parseInt(req.params.id);
  const { atendente_id } = req.body || {};
  db.prepare('UPDATE conversas SET atendente_id = ? WHERE id = ?').run(atendente_id, id);
  io.emit('conversa_atualizada', { conversa_id: id });
  res.json({ ok: true });
});

// Fechar conversa
app.put('/api/conversas/:id/fechar', (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("UPDATE conversas SET status = 'fechada' WHERE id = ?").run(id);
  io.emit('conversa_atualizada', { conversa_id: id });
  res.json({ ok: true });
});

// ============ CRIAR CONVERSA DE TESTE ============

app.post('/api/teste/conversa', (req, res) => {
  const {
    nome, telefone, mensagem,
    canal = 'whatsapp', marca = 'springland'
  } = req.body || {};

  const nomeFinal     = nome     || `Cliente ${Math.floor(Math.random() * 1000)}`;
  const telefoneFinal = telefone || `1199${Math.floor(Math.random() * 10000000)}`;
  const msgFinal      = mensagem || 'Olá, tenho interesse no combo!';

  const contato = db.prepare(`
    INSERT INTO contatos (nome, telefone, whatsapp_phone, origem, marca, ultima_interacao)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(nomeFinal, telefoneFinal, telefoneFinal, canal, marca);

  const conversa = db.prepare(`
    INSERT INTO conversas (contato_id, canal, marca, status)
    VALUES (?, ?, ?, 'aberta')
  `).run(contato.lastInsertRowid, canal, marca);

  db.prepare(`
    INSERT INTO mensagens (conversa_id, direcao, conteudo, status)
    VALUES (?, 'recebida', ?, 'recebida')
  `).run(conversa.lastInsertRowid, msgFinal);

  io.emit('nova_conversa', {
    conversa_id: conversa.lastInsertRowid,
    contato:     nomeFinal,
    mensagem:    msgFinal,
  });

  res.json({
    ok:          true,
    contato_id:  contato.lastInsertRowid,
    conversa_id: conversa.lastInsertRowid,
  });
});

// ============ WEBHOOK LOGS (debug) ============

app.get('/api/webhook-logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const rows = db.prepare(`
    SELECT id, canal, evento, processado, erro, recebido_em,
           substr(payload, 1, 500) as payload_preview
    FROM webhook_logs
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
  res.json(rows);
});

// ============ PÁGINA ADMIN ============

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.redirect('/admin');
});

// ============ WEBHOOKS META ============

// ── WhatsApp ──────────────────────────────────────────────────────────────────

app.get('/webhook/whatsapp', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === metaConfig.META_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verificado');
    res.status(200).send(challenge);
  } else {
    console.warn('⚠️  Verificação WhatsApp falhou — token:', token);
    res.sendStatus(403);
  }
});

app.post('/webhook/whatsapp', (req, res) => {
  // Responde 200 IMEDIATAMENTE (Meta tem timeout de 20s)
  res.sendStatus(200);

  // Valida assinatura (se APP_SECRET configurado)
  if (metaConfig.META_APP_SECRET && !verificarAssinaturaMeta(req)) {
    console.warn('⚠️  Assinatura WhatsApp inválida — payload ignorado');
    return;
  }

  // Processa de forma assíncrona para não bloquear
  setImmediate(() => {
    whatsapp.processarWebhookWhatsApp(req.body, db, io);
  });
});

// ── Instagram ─────────────────────────────────────────────────────────────────

app.get('/webhook/instagram', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === metaConfig.META_VERIFY_TOKEN) {
    console.log('✅ Instagram webhook verificado');
    res.status(200).send(challenge);
  } else {
    console.warn('⚠️  Verificação Instagram falhou — token:', token);
    res.sendStatus(403);
  }
});

app.post('/webhook/instagram', (req, res) => {
  // Responde 200 IMEDIATAMENTE
  res.sendStatus(200);

  if (metaConfig.META_APP_SECRET && !verificarAssinaturaMeta(req)) {
    console.warn('⚠️  Assinatura Instagram inválida — payload ignorado');
    return;
  }

  setImmediate(() => {
    instagram.processarWebhookInstagram(req.body, db, io);
  });
});

// ============ SOCKET.IO ============

io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);
  socket.on('disconnect', () => console.log('🔌 Desconectado:', socket.id));
});

// ============ START ============

server.listen(PORT, () => {
  console.log(`🚀 Inbox Springland v0.4.0 rodando na porta ${PORT}`);
  console.log(`   Admin:    http://localhost:${PORT}/admin`);
  console.log(`   Frontend: https://app.chatgruporango.tech`);
  console.log(`   Meta integração: ${metaConfig.WHATSAPP_TOKEN ? '✅ tokens configurados' : '⚠️  tokens pendentes'}`);
});
