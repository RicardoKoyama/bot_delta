const express = require("express");
const router = express.Router();
const db = require("../db/db");
const usuarioService = require("../services/usuariosService");

// --- ROTA DO CADASTRO PELO SITE ---
router.post("/cadastro-site", async (req, res) => {
  try {
    const { nome, telefone, email, api } = req.body;

    if (!nome || !telefone || !email || !api) {
      return res.status(400).json({ erro: "Campos obrigatórios faltando." });
    }

    // Verifica se API existe
    const infoApi = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM apis WHERE nome = ? AND ativa = 1", [api], (err, row) =>
        err ? reject(err) : resolve(row)
      );
    });

    if (!infoApi) {
      return res.status(400).json({ erro: "API inválida ou inativa." });
    }

    // 📌 Cadastra usuário no banco
    const novo = await usuarioService.cadastrarUsuario({
      nome,
      telefone,
      email,
      api,
      dias: 15,
      ativo: 1,
      admin: 0
    });

    // 📌 Gera mensagem personalizada
    const mensagem = await usuarioService.gerarMensagemBoasVindas(novo.nome, api);

    // 📌 Insere mensagem na fila jlf_whatsapp ou envia direto
    db.run(
      `INSERT INTO jlf_whatsapp (numero, mensagem)
       VALUES (?, ?)`,
      [novo.numero, mensagem]
    );

    return res.json({ sucesso: true });

  } catch (err) {
    console.log("Erro cadastro-site:", err);
    return res.status(500).json({ erro: "Erro interno ao cadastrar usuário." });
  }
});

module.exports = router;
