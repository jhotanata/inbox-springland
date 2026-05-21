// src/db/seed.js
// Popula o banco com dados iniciais (atendentes)

const db = require('./init');

const atendentesIniciais = [
  {
    nome: 'Jhonata',
    email: 'jhonata@springland.com.br',
    senha: 'springland2026',
    role: 'admin'
  },
  {
    nome: 'Atendente Springland',
    email: 'springland@chatgruporango.tech',
    senha: 'mudar2026',
    role: 'atendente'
  },
  {
    nome: 'Atendente Seu Rango',
    email: 'seurango@chatgruporango.tech',
    senha: 'mudar2026',
    role: 'atendente'
  }
];

const stmt = db.prepare(`
  INSERT OR IGNORE INTO atendentes (nome, email, senha, role)
  VALUES (?, ?, ?, ?)
`);

let inseridos = 0;
for (const a of atendentesIniciais) {
  const result = stmt.run(a.nome, a.email, a.senha, a.role);
  if (result.changes > 0) inseridos++;
}

console.log(`✅ Seed concluído. ${inseridos} atendentes inseridos.`);
console.log(`   Total no banco: ${db.prepare('SELECT COUNT(*) as t FROM atendentes').get().t}`);
