const express = require('express');
const router = express.Router();
const ensureAuth = require('../middlewares/auth');
const db = require('../db/db');

// LISTAGEM
router.get('/', ensureAuth, (req, res) => {
  db.all("SELECT * FROM contas_whatsapp ORDER BY nome", (err, rows) => {
    res.render('contas/index', { contas: rows });
  });
});

// FORM NOVA
router.get('/nova', ensureAuth, (req, res) => {
  res.render('contas/form', { conta: null });
});

// SALVAR NOVA / EDITADA
router.post('/salvar', ensureAuth, (req, res) => {
  const { id, nome, numero } = req.body;

  if (!id) {
    // NOVA
    db.run(`
      INSERT INTO contas_whatsapp (nome, numero, status, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [nome, numero, 'desconectado'], () => {
      res.redirect('/contas');
    });
  } else {
    // EDITAR
    db.run(`
      UPDATE contas_whatsapp
      SET nome=?, numero=?, updated_at=datetime('now')
      WHERE id=?
    `, [nome, numero, id], () => {
      res.redirect('/contas');
    });
  }
});

// EDITAR EXISTENTE
router.get('/editar/:id', ensureAuth, (req, res) => {
  db.get("SELECT * FROM contas_whatsapp WHERE id = ?", [req.params.id], (err, row) => {
    res.render('contas/form', { conta: row });
  });
});

// EXCLUIR
router.get('/excluir/:id', ensureAuth, (req, res) => {
  db.run("DELETE FROM contas_whatsapp WHERE id=?", [req.params.id], () => {
    res.redirect('/contas');
  });
});

// PLACEHOLDER — MOSTRAR QR CODE
router.get('/qrcode/:id', ensureAuth, (req, res) => {
  db.get("SELECT qr_data FROM contas_whatsapp WHERE id=?", [req.params.id], (err, row) => {
    if (!row || !row.qr_data) {
      return res.send("<h3>QR não gerado ainda. Atualize em alguns segundos.</h3>");
    }

    res.send(`
      <h2>Escaneie o QR Code</h2>
      <img src="${row.qr_data}" />
      <br/><br/>
      <a href="/contas">Voltar</a>
    `);
  });
});


// PLACEHOLDER — REINICIAR SESSÃO
router.get('/restart/:id', ensureAuth, (req, res) => {
  res.send("<h2>Reiniciar sessão — em breve!</h2>");
});

module.exports = router;
