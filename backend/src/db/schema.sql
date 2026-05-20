CREATE TABLE IF NOT EXISTS atendentes (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(100) NOT NULL,
  email      VARCHAR(100) UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  ativo      BOOLEAN DEFAULT true,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contatos (
  id             SERIAL PRIMARY KEY,
  canal          VARCHAR(20) NOT NULL CHECK (canal IN ('whatsapp', 'instagram')),
  canal_user_id  VARCHAR(100) NOT NULL,
  nome           VARCHAR(200),
  telefone       VARCHAR(30),
  ultimo_contato TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (canal, canal_user_id)
);

CREATE TABLE IF NOT EXISTS conversas (
  id           SERIAL PRIMARY KEY,
  contato_id   INTEGER NOT NULL REFERENCES contatos(id),
  marca        VARCHAR(50) NOT NULL CHECK (marca IN ('springland', 'seurango')),
  canal        VARCHAR(20) NOT NULL CHECK (canal IN ('whatsapp', 'instagram')),
  atendente_id INTEGER REFERENCES atendentes(id),
  status       VARCHAR(20) DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada')),
  nao_lidas    INTEGER DEFAULT 0,
  atualizada_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensagens (
  id              SERIAL PRIMARY KEY,
  conversa_id     INTEGER NOT NULL REFERENCES conversas(id),
  direcao         VARCHAR(10) NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  conteudo        TEXT,
  tipo            VARCHAR(20) DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'audio')),
  midia_url       TEXT,
  meta_message_id VARCHAR(200),
  criada_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id   ON mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_criada_em     ON mensagens(criada_em);
CREATE INDEX IF NOT EXISTS idx_conversas_atualizada_em ON conversas(atualizada_em DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_status        ON conversas(status);
CREATE INDEX IF NOT EXISTS idx_contatos_canal_user_id  ON contatos(canal_user_id);
