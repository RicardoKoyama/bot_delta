const express = require('express');
const router = express.Router();

const db = require('../db/db');
const { cadastrarUsuario } = require('../services/usuariosService');
const whatsappManager = require('../services/whatsapp/WhatsAppManager');

const PLANOS = {
  BASICO: { limite: 2 },
  PRO: { limite: 5 }
};

const TOKEN_MASTER = process.env.DELTA_TOKEN_MASTER;
const TABELA_PRECO_PADRAO_ID = 1;
const DIAS_TESTE = 15;

function normalizarTelefone(t) {
    t = (t || "").replace(/\D/g, "");
  if (!t.startsWith("55")) t = "55" + t;
  return t;
}

function normalizarSlug(s) {
  return (s || '').trim().toLowerCase();
}

function hojeMaisDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().substring(0, 10);
}

function sqlGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) =>
      err ? reject(err) : resolve(row || null)
    );
  });
}

function sqlRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
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
      LIMIT 1
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

    if (!listaTelefones.length) {
      return res.status(400).json({ erro: 'Nenhum telefone válido informado.' });
    }

    if (listaTelefones.length > PLANOS[plano].limite) {
      return res.status(400).json({
        erro: `Plano ${plano} permite até ${PLANOS[plano].limite} telefones.`
      });
    }

    const validadeTeste = hojeMaisDias(DIAS_TESTE);

    const insCliente = await sqlRun(
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
        TABELA_PRECO_PADRAO_ID,
        TOKEN_MASTER,
        plano,
        PLANOS[plano].limite,
        validadeTeste
      ]
    );

    const clienteId = insCliente.lastID;

    const mensagensValidacao = [];

    for (const tel of listaTelefones) {
      const ret = await cadastrarUsuario({
        nome,
        telefone: tel,
        email,
        api: 'DELTA',
        dias: DIAS_TESTE,
        ativo: 1,
        admin: 0,
        cliente_id: clienteId
      });

      if (ret?.mensagemValidacao) {
        mensagensValidacao.push({
          telefone: tel,
          mensagem: ret.mensagemValidacao
        });
      }
    }

    for (const m of mensagensValidacao) {
      const numeroWhatsApp = m.telefone.endsWith('@c.us')
        ? m.telefone
        : `${m.telefone}@c.us`;

      await whatsappManager.enviarMensagem(numeroWhatsApp, m.mensagem);
    }

    return res.json({
      sucesso: true,
      cliente_id: clienteId
    });

  } catch (err) {
    console.error('❌ Erro cadastro representante:', err);
    return res.status(500).json({ erro: 'Erro interno ao realizar cadastro.' });
  }
});

module.exports = router;
