const router = require('express').Router();
const db = require('../db');
const autenticar = require('../middleware/auth');
const { enviarWhatsApp } = require('../services/whatsapp');
const { enviarInstagram } = require('../services/instagram');

// GET /conversas?canal=whatsapp&busca=nome&pagina=1
router.get('/', autenticar, async (req, res) => {
  const { canal, busca, pagina = 1 } = req.query;
  const limite = 30;
  const offset = (Number(pagina) - 1) * limite;

  const condicoes = ['1=1'];
  const params = [];

  if (canal) {
    params.push(canal);
    condicoes.push(`c.canal = $${params.length}`);
  }
  if (busca) {
    params.push(`%${busca}%`);
    const idx = params.length;
    condicoes.push(`(ct.nome ILIKE $${idx} OR ct.telefone ILIKE $${idx})`);
  }

  params.push(limite, offset);
  const limIdx = params.length - 1;
  const offIdx = params.length;

  try {
    const { rows } = await db.query(
      `SELECT c.*, ct.nome AS contato_nome, ct.telefone, ct.canal_user_id,
              a.nome AS atendente_nome
       FROM conversas c
       JOIN contatos ct ON ct.id = c.contato_id
       LEFT JOIN atendentes a ON a.id = c.atendente_id
       WHERE ${condicoes.join(' AND ')}
       ORDER BY c.atualizada_em DESC
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[CONVERSAS] Erro ao listar:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar conversas' });
  }
});

// GET /conversas/:id/mensagens
router.get('/:id/mensagens', autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      'SELECT * FROM mensagens WHERE conversa_id = $1 ORDER BY criada_em ASC',
      [id]
    );
    await db.query('UPDATE conversas SET nao_lidas = 0 WHERE id = $1', [id]);
    res.json(rows);
  } catch (err) {
    console.error('[CONVERSAS] Erro ao buscar mensagens:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar mensagens' });
  }
});

// POST /conversas/:id/enviar
router.post('/:id/enviar', autenticar, async (req, res) => {
  const { id } = req.params;
  const { conteudo } = req.body;
  if (!conteudo) return res.status(400).json({ erro: 'Conteúdo obrigatório' });

  try {
    const { rows } = await db.query(
      `SELECT c.canal, ct.canal_user_id
       FROM conversas c
       JOIN contatos ct ON ct.id = c.contato_id
       WHERE c.id = $1`,
      [id]
    );
    const conversa = rows[0];
    if (!conversa) return res.status(404).json({ erro: 'Conversa não encontrada' });

    let meta_message_id;
    if (conversa.canal === 'whatsapp') {
      meta_message_id = await enviarWhatsApp(conversa.canal_user_id, conteudo);
    } else {
      meta_message_id = await enviarInstagram(conversa.canal_user_id, conteudo);
    }

    const { rows: [msg] } = await db.query(
      `INSERT INTO mensagens (conversa_id, direcao, conteudo, tipo, meta_message_id)
       VALUES ($1, 'saida', $2, 'texto', $3) RETURNING *`,
      [id, conteudo, meta_message_id]
    );
    await db.query('UPDATE conversas SET atualizada_em = NOW() WHERE id = $1', [id]);

    req.io.emit('mensagem:nova', { conversa_id: Number(id), mensagem: msg });
    res.json(msg);
  } catch (err) {
    console.error('[CONVERSAS] Erro ao enviar:', err.message);
    res.status(500).json({ erro: 'Erro ao enviar mensagem' });
  }
});

// POST /conversas/:id/atribuir
router.post('/:id/atribuir', autenticar, async (req, res) => {
  const { id } = req.params;
  const { atendente_id } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE conversas
       SET atendente_id = $1, atualizada_em = NOW()
       WHERE id = $2 RETURNING *`,
      [atendente_id, id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Conversa não encontrada' });
    req.io.emit('conversa:atualizada', rows[0]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[CONVERSAS] Erro ao atribuir:', err.message);
    res.status(500).json({ erro: 'Erro ao atribuir atendente' });
  }
});

module.exports = router;
