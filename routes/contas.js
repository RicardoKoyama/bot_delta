const express = require('express');
const router = express.Router();
const ensureAuth = require('../middlewares/auth');

router.get('/', ensureAuth, (req, res) => {
  res.send("<h2>Contas WhatsApp (em construção)</h2>");
});

module.exports = router;
