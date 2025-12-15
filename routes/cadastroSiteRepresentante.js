// routes/cadastroSiteRepresentante.js
// Cadastro de clientes via representante (SaaS)
// - Cria CLIENTE
// - Cria USUÁRIOS via usuariosService (LID-safe)
// - Dispara mensagem de validação (mesmo fluxo do teste-grátis)

const express = require('express');
const router = express.Router();

const db = require('../db/db'); // ajuste o path se necessário
const { cadastrarUsuario } = require('../services/usuariosService');

// ================================
// Configuração
// ================================
const PLANOS = {
  BASICO: { limite: 2 },
  PRO: { limite: 5 }
};

const TOKEN_MASTER = process.env.DELTA_TOKEN_MASTER; // obrigatório
const TABELA_PRECO_PADRAO_ID = 1; // ajuste se necessário
const DIAS_TESTE = 15;

// ================================
// Helpers
// ================================
function normalizarTelefone(t) {
  return (t || '').replace(/\D/g, '');
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
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
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

// ================================
// Rota
// ================================
router.post('/cadastro-representante/:slug', async (req, res) => {
  try {
    const slug = normalizarSlug(req.params.slug);

    const {
      nome_loja,
      nome,
      telefone,   // telefone principal (responsável)
      email,
      plano,
      telefones   // lista separada por vírgula
    } = req.body;

    // ----------------------------
    // Validações
    // ----------------------------
    if (!nome_loja || !nome || !telefone || !plano || !telefones) {
      return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
    }

    if (!PLANOS[plano]) {
      return res.status(400).json({ erro: 'Plano inválido.' });
    }

    if (!TOKEN_MASTER) {
      return res.status(500).json({ erro: 'Token master não configurado.' });
    }

    // ----------------------------
    // Resolver representante (slug = nome)
    // ----------------------------
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

    // ----------------------------
    // Preparar telefones
    // ----------------------------
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

    // ----------------------------
    // Criar CLIENTE
    // ----------------------------
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

    // ----------------------------
    // Criar USUÁRIOS via usuariosService
    // (mantém fluxo de validação + LID)
    // ----------------------------
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
        cliente_id: clienteId // importante: vincula ao cliente
      });

      // O service já prepara a mensagem de validação
      if (ret?.mensagemValidacao) {
        mensagensValidacao.push({
          telefone: tel,
          mensagem: ret.mensagemValidacao
        });
      }
    }

    // ----------------------------
    // Resposta
    // O envio das mensagens fica com o fluxo existente
    // (router/manager de WhatsApp do bot)
    // ----------------------------
    return res.json({
      sucesso: true,
      cliente_id: clienteId,
      mensagensValidacao
    });

  } catch (err) {
    console.error('❌ Erro cadastro representante:', err);
    return res.status(500).json({ erro: 'Erro interno ao realizar cadastro.' });
  }
});

module.exports = router;
