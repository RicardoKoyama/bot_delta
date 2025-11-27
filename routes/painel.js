const express = require('express');
const router = express.Router();
const ensureAuth = require('../middlewares/auth');

router.get('/', ensureAuth, (req, res) => {
  res.render('painel/dashboard', {
    user: req.session.user
  });
});

router.get('/login', (req, res) => {
  res.render('painel/login', { error: null });
});

router.post('/login', (req, res) => {
  const { usuario, senha } = req.body;

  // login fixo temporário — depois vamos colocar no SQLite
  if (usuario === process.env.ADMIN_USER && senha === process.env.ADMIN_PASS) {
    req.session.user = { usuario };
    return res.redirect('/');
  }

  res.render('painel/login', { error: 'Usuário ou senha inválidos' });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
