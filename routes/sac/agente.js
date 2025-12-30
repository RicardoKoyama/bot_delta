const express = require('express');
const router = express.Router();
const { pool } = require('../../services/dbService');

/**
 * GET /sac/agente/chamados
 */
router.get('/agente/chamados', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT id, protocolo, status, criado_em
    FROM sac.sac_chamados
    ORDER BY criado_em DESC
  `);
  res.json(rows);
});

/**
 * GET /sac/agente/chamado/:id
 */
router.get('/agente/chamado/:id', async (req, res) => {
  const { id } = req.params;

  const chamado = await pool.query(`
    SELECT *
    FROM sac.sac_chamados
    WHERE id = $1
  `, [id]);

  const eventos = await pool.query(`
    SELECT tipo, origem, descricao, criado_em
    FROM sac.sac_eventos
    WHERE chamado_id = $1
    ORDER BY criado_em ASC
  `, [id]);

  res.json({
    chamado: chamado.rows[0],
    eventos: eventos.rows
  });
});

module.exports = router;
