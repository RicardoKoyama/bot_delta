const express = require('express');
const router = express.Router();
const ensureAuth = require('../middlewares/auth');
const db = require('../db/db');
const { getClient } = require("../services/whatsapp/whatsappClient");

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

// SALVAR (NOVO + EDICAO)
router.post('/salvar', ensureAuth, (req, res) => {
  const { id, nome, phone_number, validade, is_active } = req.body;

  const ativo = is_active === 'on' ? 1 : 0;

  // ------------------------------
  //  NOVO USUÁRIO → ENVIA BOAS-VINDAS
  // ------------------------------
  if (!id) {
    db.run(
      `INSERT INTO usuarios (nome, phone_number, validade, is_active)
       VALUES (?, ?, ?, ?)`,
      [nome, phone_number, validade, ativo],
      async (err) => {
        if (err) {
          console.error(err);
          return res.redirect('/usuarios');
        }

        try {
          // Formata número
          const numero = phone_number.replace(/\D/g, "");
          const wa = getClient("BOT_1");

          const mensagem = 
`👋 *Bem-vindo ao BOT da Koyama Tecnologia!*

Aqui você pode consultar produtos Delta de forma rápida e simples.

Comandos disponíveis:
• *cg <texto>* — busca por nome/descrição
• *cg 1234* — busca por código
• Envie *foto com QR Code* — consulta automática

Se precisar de ajuda, envie:
*ajuda*`;

          if (wa && numero.length >= 10) {
            await wa.sendMessage(`55${numero}@c.us`, mensagem);
            console.log(`📩 Mensagem de boas-vindas enviada para ${numero}`);
          } else {
            console.log("⚠️ Cliente WhatsApp não disponível ou telefone inválido.");
          }
        } catch (e) {
          console.error("❌ Erro ao enviar boas-vindas:", e);
        }

        return res.redirect('/usuarios');
      }
    );
  } 
  
  // ------------------------------
  //  UPDATE → NÃO MANDA MENSAGEM
  // ------------------------------
  else {
    db.run(
      `UPDATE usuarios
       SET nome=?, phone_number=?, validade=?, is_active=?
       WHERE id=?`,
      [nome, phone_number, validade, ativo, id],
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
