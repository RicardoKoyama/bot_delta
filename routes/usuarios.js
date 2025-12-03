const express = require('express');
const router = express.Router();
const ensureAuth = require('../middlewares/auth');
const db = require('../db/db');
const usuarioService = require('../services/usuariosService');
const { registrarLog } = require("../services/logService");

// LISTAR
router.get('/', ensureAuth, (req, res) => {
  const sql = `
    SELECT u.*,
           m.descricao AS mensagem_descricao
    FROM usuarios u
    LEFT JOIN mensagem_whatsapp m ON m.id = u.id_mensagem
    ORDER BY u.nome
  `;

  db.all(sql, (err, rows) => {
    res.render('usuarios/index', { usuarios: rows });
  });
});

// FORM NOVO
router.get('/novo', ensureAuth, (req, res) => {
  db.all("SELECT * FROM mensagem_whatsapp ORDER BY descricao", (err, mensagens) => {
    res.render('usuarios/form', { usuario: null, mensagens });
  });
});

router.post('/salvar', ensureAuth, (req, res) => {
  const { id, nome, telefone, validade,
          ativo, administrador, id_mensagem, token } = req.body;

  const ativoInt = ativo === 'on' ? 1 : 0;
  const adminInt = administrador === 'on' ? 1 : 0;
  const msg = id_mensagem || null;
  const tok = token || null;

  if (!id) {

    usuarioService
      .cadastrarUsuario({
        nome,
        telefone,
        dias: 15,
        ativo: ativoInt,
        admin: adminInt,
        id_mensagem: msg,
        token: tok
      })
      .then(() => res.redirect('/usuarios'))
      .catch(() => res.redirect('/usuarios'));

  } else {

    db.run(`
      UPDATE usuarios
      SET nome=?, telefone=?, validade=?, ativo=?, administrador=?,
          id_mensagem=?, token=?
      WHERE id=?`,
      [nome, telefone, validade, ativoInt, adminInt, msg, tok, id],
      () => res.redirect('/usuarios')
    );

  }
});


// EDITAR
router.get('/editar/:id', ensureAuth, (req, res) => {
  db.get("SELECT * FROM usuarios WHERE id = ?", [req.params.id], (err, usuario) => {
    db.all("SELECT * FROM mensagem_whatsapp ORDER BY descricao", (err2, mensagens) => {
      res.render('usuarios/form', { usuario, mensagens });
    });
  });
});

// EXCLUIR
router.get('/excluir/:id', ensureAuth, (req, res) => {
  db.run("DELETE FROM usuarios WHERE id = ?", [req.params.id], () => {
    res.redirect('/usuarios');
  });
});

module.exports = router;
