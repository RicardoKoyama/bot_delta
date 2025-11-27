const express = require('express');
const router = express.Router();
const ensureAuth = require('../middlewares/auth');
const db = require('../db/db');

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

  if (!id) {
    // INSERT
    db.run(
      `INSERT INTO usuarios (nome, phone_number, validade, is_active)
       VALUES (?, ?, ?, ?)`,
      [nome, phone_number, validade, ativo],
      (err) => {
        if (err) console.error(err);
        res.redirect('/usuarios');
      }
    );
  } else {
    // UPDATE
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
