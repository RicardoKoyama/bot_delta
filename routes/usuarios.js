const express = require('express');
const router = express.Router();
const ensureAuth = require('../middlewares/auth');
const db = require('../db/db');
const whatsappManager = require("../services/whatsapp/WhatsAppManager");

// LISTAGEM
router.get('/', ensureAuth, (req, res) => {
  db.all("SELECT * FROM usuarios ORDER BY nome", (err, rows) => {
    res.render('usuarios/index', { usuarios: rows });
  });
});

// FORM NOVO
router.get('/novo', ensureAuth, (req, res) => {
  res.render('usuarios/form', { usuario: null });
});


router.post('/salvar', ensureAuth, (req, res) => {
  const { id, nome, phone_number, validade, is_active } = req.body;

  const ativo = is_active === 'on' ? 1 : 0;

  // 🔧 Normalizar telefone: manter sempre 55 + DDD + número
  let numero = (phone_number || '').replace(/\D/g, '');
  if (!numero.startsWith('55')) {
    numero = '55' + numero;
  }

  if (!id) {
    // INSERT
    db.run(
      `INSERT INTO usuarios (nome, phone_number, validade, is_active)
       VALUES (?, ?, ?, ?)`,
      [nome, numero, validade, ativo],
      async (err) => {
        if (err) {
          console.error(err);
          return res.redirect('/usuarios');
        }

        // 🔥 Envio da mensagem de boas-vindas
        try {
          const whatsappManager = require("../services/whatsapp/WhatsAppManager");
          const wa = whatsappManager.getClientByName("BOT_1");

          // Capitaliza o nome — ex: "ricardo koyama" → "Ricardo Koyama"
          const formatarNome = (texto) =>
            texto
              .toLowerCase()
              .split(" ")
              .map(p => p.charAt(0).toUpperCase() + p.slice(1))
              .join(" ");

          const nomeFormatado = formatarNome(nome);

          const mensagem = 
        `Prezado(a) *${nomeFormatado}*,

        🎉 *Seja muito bem-vindo ao BOT da Koyama Tecnologia!*

        Agora você já pode consultar produtos Delta de forma rápida e simples.

        🧭 *Meios de consulta disponíveis:*
        • Envie *nome do produto*, ex barcelona - busca por descrição que contenha *barcelona*
        • Envie *código*, ex: 3186 — busca pelo código do produto
        • Envie uma *foto do QR Code da peça* — consulta automática do produto`;

          if (wa) {
            await wa.sendMessage(`${numero}@c.us`, mensagem);
            console.log(`📩 Boas-vindas personalizada enviada para ${numero}`);
          } else {
            console.log("⚠️ Cliente WhatsApp não disponível.");
          }
        } catch (e) {
          console.error("❌ Erro ao enviar boas-vindas:", e);
        }
        return res.redirect('/usuarios');
      }
    );
  } else {
    // UPDATE
    db.run(
      `UPDATE usuarios
       SET nome=?, phone_number=?, validade=?, is_active=?
       WHERE id=?`,
      [nome, numero, validade, ativo, id],
      (err) => {
        if (err) console.error(err);
        res.redirect('/usuarios');
      }
    );
  }
});

// EDITAR
router.get('/editar/:id', ensureAuth, (req, res) => {
  db.get(
    "SELECT * FROM usuarios WHERE id = ?",
    [req.params.id],
    (err, row) => {
      res.render('usuarios/form', { usuario: row });
    }
  );
});

// EXCLUIR
router.get('/excluir/:id', ensureAuth, (req, res) => {
  db.run("DELETE FROM usuarios WHERE id = ?", [req.params.id], (err) => {
    res.redirect('/usuarios');
  });
});

module.exports = router;
