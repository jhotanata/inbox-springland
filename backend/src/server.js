// src/server.js
// Servidor principal do Inbox Springland

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const db = require('./db/init');

// Rodar seed automaticamente se banco estiver vazio
const totalAtendentes = db.prepare('SELECT COUNT(*) as t FROM atendentes').get().t;
if (totalAtendentes === 0) {
  console.log('⚙️  Banco vazio. Rodando seed automático...');
  require('./db/seed');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3001;

// ============ MIDDLEWARES ============
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ ROTAS BÁSICAS ============

// Health check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    versao: '0.2.0',
    banco: 'sqlite',
    atendentes: db.prepare('SELECT COUNT(*) as t FROM atendentes').get().t,
    conversas: db.prepare('SELECT COUNT(*) as t FROM conversas').get().t,
    mensagens: db.prepare('SELECT COUNT(*) as t FROM mensagens').get().t,
  });
});

// API: listar atendentes (sem senha)
app.get('/api/atendentes', (req, res) => {
  const rows = db.prepare(`
    SELECT id, nome, email, role, ativo, criado_em
    FROM atendentes
    ORDER BY id
  `).all();
  res.json(rows);
});

// API: stats gerais
app.get('/api/stats', (req, res) => {
  const stats = {
    atendentes: db.prepare('SELECT COUNT(*) as t FROM atendentes WHERE ativo = 1').get().t,
    contatos: db.prepare('SELECT COUNT(*) as t FROM contatos').get().t,
    conversas_abertas: db.prepare("SELECT COUNT(*) as t FROM conversas WHERE status = 'aberta'").get().t,
    conversas_total: db.prepare('SELECT COUNT(*) as t FROM conversas').get().t,
    mensagens_total: db.prepare('SELECT COUNT(*) as t FROM mensagens').get().t,
  };
  res.json(stats);
});

// API: criar mensagem de teste (pra simular uma conversa)
app.post('/api/teste/conversa', (req, res) => {
  const { nome = 'Cliente Teste', telefone = '11999999999', mensagem = 'Olá!' } = req.body || {};

  const insertContato = db.prepare(`
    INSERT INTO contatos (nome, telefone, origem, marca, ultima_interacao)
    VALUES (?, ?, 'whatsapp', 'springland', CURRENT_TIMESTAMP)
  `);
  const contato = insertContato.run(nome, telefone);

  const insertConversa = db.prepare(`
    INSERT INTO conversas (contato_id, canal, marca, status)
    VALUES (?, 'whatsapp', 'springland', 'aberta')
  `);
  const conversa = insertConversa.run(contato.lastInsertRowid);

  const insertMsg = db.prepare(`
    INSERT INTO mensagens (conversa_id, direcao, conteudo)
    VALUES (?, 'recebida', ?)
  `);
  insertMsg.run(conversa.lastInsertRowid, mensagem);

  io.emit('nova_conversa', { contato: nome, mensagem });

  res.json({ ok: true, contato_id: contato.lastInsertRowid, conversa_id: conversa.lastInsertRowid });
});

// ============ PÁGINA ADMIN VISUAL ============

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Rota raiz redireciona pra /admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// ============ WEBHOOKS (placeholder) ============

app.get('/webhook/whatsapp', (req, res) => {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'springland_invasao_2026_xyz';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook WhatsApp verificado');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook/whatsapp', (req, res) => {
  console.log('📩 Mensagem WhatsApp recebida:', JSON.stringify(req.body));
  res.sendStatus(200);
});

app.get('/webhook/instagram', (req, res) => {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'springland_invasao_2026_xyz';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook/instagram', (req, res) => {
  console.log('📸 Mensagem Instagram recebida:', JSON.stringify(req.body));
  res.sendStatus(200);
});

// ============ SOCKET.IO ============

io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// ============ START ============

server.listen(PORT, () => {
  console.log(`🚀 Inbox Springland rodando na porta ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Admin:  http://localhost:${PORT}/admin`);
});
