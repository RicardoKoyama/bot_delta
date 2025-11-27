const express = require('express');
const router = express.Router();
const ensureAuth = require('../middlewares/auth');
const db = require('../db/db');

// LISTAGEM + FILTROS
router.get('/', ensureAuth, (req, res) => {
  const { phone, data_ini, data_fim } = req.query;

  let sql = "SELECT * FROM logs WHERE 1=1";
  const params = [];

  if (phone && phone.trim()) {
    sql += " AND phone_number LIKE ?";
    params.push(`%${phone.trim()}%`);
  }

  if (data_ini && data_ini.trim()) {
    sql += " AND date(data) >= date(?)";
    params.push(data_ini.trim());
  }

  if (data_fim && data_fim.trim()) {
    sql += " AND date(data) <= date(?)";
    params.push(data_fim.trim());
  }

  sql += " ORDER BY data DESC LIMIT 200";

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.send("Erro ao carregar logs");
    }

    res.render('logs/index', {
      logs: rows,
      filtros: {
        phone: phone || '',
        data_ini: data_ini || '',
        data_fim: data_fim || ''
      }
    });
  });
});

module.exports = router;
