const express = require("express");
const router = express.Router();
const db = require("../db/db");
const usuarioService = require("../services/usuariosService");
const whatsappManager = require("../services/whatsapp/WhatsAppManager");

router.post("/cadastro-site", async (req, res) => {
  try {
    const { nome, telefone, email, api } = req.body;

    if (!nome || !telefone || !email || !api) {
      return res.status(400).json({ erro: "Campos obrigatórios faltando." });
    }

    // Verifica API
    const infoApi = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM apis WHERE nome = ? AND ativa = 1", [api], (err, row) =>
        err ? reject(err) : resolve(row)
      );
    });

    if (!infoApi) {
      return res.status(400).json({ erro: "API inválida ou inativa." });
    }

    // Cadastrar usuário
    const novo = await usuarioService.cadastrarUsuario({
      nome,
      telefone,
      email,
      api,
      dias: 15,
      ativo: 1,
      admin: 0
    });

    // Gerar mensagem personalizada
    const mensagem = await usuarioService.gerarMensagemBoasVindas(novo.nome, api);

    // Envio WhatsApp direto (igual seus handlers)
    await whatsappManager.enviarMensagem(novo.numero, mensagem);

    return res.json({ sucesso: true });

  } catch (err) {
    console.log("Erro cadastro-site:", err);
    return res.status(500).json({ erro: "Erro interno ao cadastrar usuário." });
  }
});

module.exports = router;
