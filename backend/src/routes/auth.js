const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha obrigatórios' });
  }
  try {
    const { rows } = await db.query(
      'SELECT * FROM atendentes WHERE email = $1 AND ativo = true',
      [email]
    );
    const atendente = rows[0];
    if (!atendente || !(await bcrypt.compare(senha, atendente.senha_hash))) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }
    const token = jwt.sign(
      { id: atendente.id, nome: atendente.nome, email: atendente.email },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      token,
      atendente: { id: atendente.id, nome: atendente.nome, email: atendente.email },
    });
  } catch (err) {
    console.error('[AUTH] Erro no login:', err.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
