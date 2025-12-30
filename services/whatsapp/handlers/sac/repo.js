const { pool } = require('../../../dbService'); // mesmo padrão do MSI

async function criarChamado({ lid, protocolo, token }) {
  const { rows } = await pool.query(`
    INSERT INTO sac.sac_chamados
      (lid, protocolo, token_formulario)
    VALUES ($1, $2, $3)
    RETURNING id
  `, [lid, protocolo, token]);

  return rows[0].id;
}

async function registrarEvento(chamadoId, tipo, descricao = null) {
  await pool.query(`
    INSERT INTO sac.sac_eventos
      (chamado_id, tipo, origem, descricao)
    VALUES ($1, $2, 'bot', $3)
  `, [chamadoId, tipo, descricao]);
}

async function existeChamadoAtivoPorLid(lid) {
  const { rows } = await pool.query(`
    SELECT id, protocolo, token_formulario, status
    FROM sac.sac_chamados
    WHERE lid = $1
      AND status IN ('pre_aberto', 'aberto', 'em_atendimento')
    ORDER BY criado_em DESC
    LIMIT 1
  `, [lid]);

  return rows[0] || null;
}

module.exports = {
  criarChamado,
  registrarEvento,
  existeChamadoAtivoPorLid
};
