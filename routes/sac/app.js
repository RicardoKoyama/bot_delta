const express = require('express');
const router = express.Router();
const { pool } = require('../../services/dbService');

/**
 *** GET /sac/app/chamados
 * Lista chamados disponíveis para atendimento
 */
router.get('/app/chamados', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        protocolo,
        nome_cliente,
        status,
        criado_em
      FROM sac.sac_chamados
      WHERE status IN ('aberto', 'em_atendimento')
      ORDER BY criado_em ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error('[SAC APP] Erro ao listar chamados:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

/**
 * POST /sac/app/atendimento
 * Registra atendimento feito no app
 */
router.post('/app/atendimento', async (req, res) => {
  try {
    const {
      chamado_id,
      observacao,
      latitude,
      longitude,
      foto_base64
    } = req.body;

    if (!chamado_id || !foto_base64) {
      return res.status(400).json({
        erro: 'chamado_id e foto são obrigatórios'
      });
    }

    // 1️⃣ grava atendimento
    await pool.query(`
      INSERT INTO sac.sac_atendimentos_app
        (chamado_id, observacao, latitude, longitude, foto_app_path, sincronizado)
      VALUES ($1, $2, $3, $4, $5, true)
    `, [
      chamado_id,
      observacao || null,
      latitude || null,
      longitude || null,
      foto_base64 // MVP: base64 direto (pode virar path depois)
    ]);

    // 2️⃣ atualiza chamado
    await pool.query(`
      UPDATE sac.sac_chamados
         SET status = 'atendido'
       WHERE id = $1
    `, [chamado_id]);

    // 3️⃣ registra evento
    await pool.query(`
      INSERT INTO sac.sac_eventos
        (chamado_id, tipo, origem, descricao)
      VALUES ($1, 'app_atendimento_registrado', 'app', 'Atendimento registrado via aplicativo')
    `, [chamado_id]);

    res.json({ sucesso: true });

  } catch (err) {
    console.error('[SAC APP] Erro ao registrar atendimento:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
