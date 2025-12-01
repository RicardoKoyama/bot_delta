const express = require('express');
const router = express.Router();
const ensureAuth = require('../middlewares/auth');
const db = require('../db/db');
const usuarioService = require('../services/usuariosService');
const { registrarLog } = require("../services/logService");

// LISTAR
router.get('/', ensureAuth, (req, res) => {
  db.all("SELECT * FROM usuarios ORDER BY nome", (err, rows) => {
    res.render('usuarios/index', { usuarios: rows });
  });
});

// FORM NOVO
router.get('/novo', ensureAuth, (req, res) => {
  res.render('usuarios/form', { usuario: null });
});

// SALVAR
router.post('/salvar', ensureAuth, (req, res) => {
  const { id, nome, phone_number, validade, is_active, is_admin } = req.body;
  const ativo = is_active === 'on' ? 1 : 0;
  const admin = is_admin === 'on' ? 1 : 0;

  if (!id) {
    // CADASTRAR NOVO — via service centralizado
    usuarioService.cadastrarUsuario({
      nome,
      telefone: phone_number,
      dias: 15,
      ativo,
      admin
    })
    .then((u) => {
      registrarLog({
        phone: u.numero,
        tipo: "cadastro_web",
        mensagem: "Cadastro via painel",
        info: { nome: u.nome }
      });
      res.redirect('/usuarios');
    })
    .catch(() => res.redirect('/usuarios'));
  } else {
    // UPDATE
    db.run(
      `UPDATE usuarios
       SET nome=?, phone_number=?, validade=?, is_active=?, is_admin=?
       WHERE id=?`,
      [nome, phone_number, validade, ativo, admin, id],
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
