require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./src/db');

const atendentes = [
  { nome: 'Admin',       email: 'admin@inbox.local',       senha: 'Admin@123' },
  { nome: 'Atendente 1', email: 'atendente1@inbox.local',  senha: 'Atendente@123' },
  { nome: 'Atendente 2', email: 'atendente2@inbox.local',  senha: 'Atendente@123' },
];

async function seed() {
  for (const a of atendentes) {
    const senha_hash = await bcrypt.hash(a.senha, 10);
    await db.query(
      `INSERT INTO atendentes (nome, email, senha_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [a.nome, a.email, senha_hash]
    );
    console.log(`✓ ${a.nome} <${a.email}>`);
  }
  console.log('\nSeed concluído. Troque as senhas após o primeiro login!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Erro no seed:', err.message);
  process.exit(1);
});
