const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { pool } = require('../../services/dbService');

// upload local (MVP)
const upload = multer({
  dest: path.join(__dirname, '../../uploads/sac')
});

/**
 *** GET /sac/chamado/:token
 * Retorna dados do chamado para o portal do cliente
 */
router.get('/chamado/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { rows } = await pool.query(`
      SELECT id, protocolo, status
      FROM sac.sac_chamados
      WHERE token_formulario = $1
      LIMIT 1
    `, [token]);

    if (!rows.length) {
      return res.status(404).json({ erro: 'Chamado não encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[SAC] Erro GET chamado:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

/**
 * POST /sac/chamado/:token/formulario
 * Cliente preenche dados do chamado
 */
router.post('/chamado/:token/formulario', upload.single('foto'), async (req, res) => {
  try {
    const { token } = req.params;
    const { nome, telefone, email, descricao } = req.body;

    const fotoPath = req.file ? req.file.path : null;

    const { rowCount } = await pool.query(`
      UPDATE sac.sac_chamados
         SET nome_cliente = $1,
             telefone = $2,
             email = $3,
             descricao = $4,
             foto_portal_path = $5,
             status = 'aberto'
       WHERE token_formulario = $6
         AND status = 'pre_aberto'
    `, [nome, telefone, email, descricao, fotoPath, token]);

    if (!rowCount) {
      return res.status(400).json({ erro: 'Chamado inválido ou já preenchido' });
    }

    await pool.query(`
      INSERT INTO sac.sac_eventos
        (chamado_id, tipo, origem, descricao)
      SELECT id, 'formulario_preenchido', 'portal',
             'Formulário preenchido pelo cliente'
      FROM sac.sac_chamados
      WHERE token_formulario = $1
    `, [token]);

    res.json({ sucesso: true });
  } catch (err) {
    console.error('[SAC] Erro POST formulario:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
