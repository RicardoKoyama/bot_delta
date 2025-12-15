

const express = require('express');
const db = require('../db/db'); 
const router = express.Router();


const PLANOS = {
  BASICO: { limite: 2 },
  PRO: { limite: 5 }
};

const TOKEN_MASTER = process.env.DELTA_TOKEN_MASTER || null;

function normalizarTelefone(tel) {
  return tel.replace(/\D/g, '');
}

function normalizarSlug(str) {
  return str.trim().toLowerCase();
}

function sqlGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function sqlRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

router.post('/cadastro-representante/:slug', async (req, res) => {
  try {
    const slug = normalizarSlug(req.params.slug);

    const {
      nome_loja,
      nome,
      telefone,
      email,
      plano,
      telefones
    } = req.body;

    if (!nome_loja || !nome || !telefone || !plano || !telefones) {
      return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
    }

    if (!PLANOS[plano]) {
      return res.status(400).json({ erro: 'Plano inválido.' });
    }

    if (!TOKEN_MASTER) {
      return res.status(500).json({ erro: 'Token master não configurado.' });
    }

    const representante = await sqlGet(
      `
      SELECT id, nome
      FROM representantes
      WHERE LOWER(nome) = ?
        AND ativo = 1
      `,
      [slug]
    );

    if (!representante) {
      return res.status(404).json({ erro: 'Representante não encontrado.' });
    }

    const listaTelefones = telefones
      .split(',')
      .map(t => normalizarTelefone(t))
      .filter(t => t.length >= 10);

    if (listaTelefones.length === 0) {
      return res.status(400).json({ erro: 'Nenhum telefone válido informado.' });
    }

    if (listaTelefones.length > PLANOS[plano].limite) {
      return res.status(400).json({
        erro: `Plano ${plano} permite até ${PLANOS[plano].limite} telefones.`
      });
    }

    const validadeTeste = new Date();
    validadeTeste.setDate(validadeTeste.getDate() + 15);

    const insertCliente = await sqlRun(
      `
      INSERT INTO clientes (
        representante_id,
        nome,
        tabela_preco_id,
        ativo,
        token_api,
        origem_token,
        plano,
        limite_telefones,
        validade_teste
      ) VALUES (?, ?, ?, 1, ?, 'master', ?, ?, ?)
      `,
      [
        representante.id,
        nome_loja,
        1, 
        TOKEN_MASTER,
        plano,
        PLANOS[plano].limite,
        validadeTeste.toISOString().substring(0, 10)
      ]
    );

    const clienteId = insertCliente.lastID;

    for (const tel of listaTelefones) {
      await sqlRun(
        `
        INSERT INTO usuarios (
          nome,
          telefone,
          validade,
          ativo,
          api,
          cliente_id
        ) VALUES (?, ?, ?, 1, 'DELTA', ?)
        `,
        [
          nome,
          tel,
          validadeTeste.toISOString().substring(0, 10),
          clienteId
        ]
      );
    }

    return res.json({
      sucesso: true,
      mensagem: 'Cadastro realizado com sucesso.',
      cliente_id: clienteId
    });

  } catch (err) {
    console.error('❌ Erro cadastro representante:', err);
    return res.status(500).json({ erro: 'Erro interno ao realizar cadastro.' });
  }
});

module.exports = router;
