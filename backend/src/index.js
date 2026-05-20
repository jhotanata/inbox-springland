require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

// Captura rawBody (Buffer) para validação de assinatura da Meta
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(cors());

// Injeta instância do Socket.io em todas as rotas
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// Rotas
app.use('/auth', require('./routes/auth'));
app.use('/conversas', require('./routes/conversas'));
app.use('/webhook/whatsapp', require('./routes/webhooks/whatsapp'));
app.use('/webhook/instagram', require('./routes/webhooks/instagram'));

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date() }));

// Eventos Socket.io
io.on('connection', (socket) => {
  console.log(`[SOCKET] Atendente conectado: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[SOCKET] Atendente desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[SERVER] Backend rodando na porta ${PORT}`);
});
