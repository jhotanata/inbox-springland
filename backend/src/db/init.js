// src/db/init.js
// Cria o banco SQLite e todas as tabelas

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Caminho do banco: pasta /data dentro do container (persistente)
const DB_DIR = process.env.DB_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'inbox.db');

// Garante que a pasta exista
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ============ SCHEMA ============

const schema = `
CREATE TABLE IF NOT EXISTS atendentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  role TEXT DEFAULT 'atendente',
  ativo INTEGER DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contatos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT,
  telefone TEXT,
  instagram_id TEXT,
  origem TEXT,
  marca TEXT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultima_interacao DATETIME
);

CREATE TABLE IF NOT EXISTS conversas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contato_id INTEGER NOT NULL,
  canal TEXT NOT NULL,
  marca TEXT,
  status TEXT DEFAULT 'aberta',
  atendente_id INTEGER,
  criada_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizada_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contato_id) REFERENCES contatos(id),
  FOREIGN KEY (atendente_id) REFERENCES atendentes(id)
);

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversa_id INTEGER NOT NULL,
  direcao TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  meta_id TEXT,
  enviada_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversa_id) REFERENCES conversas(id)
);

CREATE INDEX IF NOT EXISTS idx_conversas_status ON conversas(status);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_contatos_telefone ON contatos(telefone);
`;

db.exec(schema);

// ============ MIGRAÇÕES (ALTER TABLE) ============
// SQLite falha silenciosamente se coluna já existe — cada um em try/catch

const migracoes = [
  // Contatos
  `ALTER TABLE contatos ADD COLUMN whatsapp_phone TEXT`,
  `ALTER TABLE contatos ADD COLUMN instagram_username TEXT`,
  `ALTER TABLE contatos ADD COLUMN avatar_url TEXT`,
  // Conversas
  `ALTER TABLE conversas ADD COLUMN canal_id TEXT`,
  `ALTER TABLE conversas ADD COLUMN page_id TEXT`,
  // Mensagens
  `ALTER TABLE mensagens ADD COLUMN meta_message_id TEXT`,
  `ALTER TABLE mensagens ADD COLUMN anexo_url TEXT`,
  `ALTER TABLE mensagens ADD COLUMN status TEXT DEFAULT 'enviada'`,
];

for (const sql of migracoes) {
  try { db.exec(sql); } catch (e) { /* coluna já existe, ignorar */ }
}

// Tabela de logs de webhook
db.exec(`
  CREATE TABLE IF NOT EXISTS webhook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canal TEXT NOT NULL,
    evento TEXT,
    payload TEXT,
    processado INTEGER DEFAULT 0,
    erro TEXT,
    recebido_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_msg_meta_id ON mensagens(meta_message_id);
  CREATE INDEX IF NOT EXISTS idx_contato_whatsapp ON contatos(whatsapp_phone);
  CREATE INDEX IF NOT EXISTS idx_contato_instagram ON contatos(instagram_username);
`);

console.log('✅ Banco SQLite inicializado em:', DB_PATH);

module.exports = db;
