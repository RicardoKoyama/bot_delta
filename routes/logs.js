const express = require("express");
const router = express.Router();
const ensureAuth = require("../middlewares/auth");
const db = require("../db/db");

router.get("/", ensureAuth, (req, res) => {
  const phone = req.query.phone || "";
  const data_ini = req.query.data_ini || "";
  const data_fim = req.query.data_fim || "";
  const tipo = req.query.tipo || "";   // <-- NOVO FILTRO

  let where = "WHERE 1 = 1";
  const params = [];

  if (phone) {
    where += " AND phone LIKE ?";
    params.push(`%${phone}%`);
  }

  if (tipo) {
    where += " AND tipo = ?";
    params.push(tipo);
  }

  if (data_ini) {
    where += " AND date(data_hora) >= date(?)";
    params.push(data_ini);
  }

  if (data_fim) {
    where += " AND date(data_hora) <= date(?)";
    params.push(data_fim);
  }

  const sql = `
    SELECT *
    FROM logs_bot
    ${where}
    ORDER BY id DESC
    LIMIT 200
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.send("Erro ao consultar logs.");

    res.render("logs/index", {
      logs: rows,
      filtros: { phone, data_ini, data_fim, tipo }
    });
  });
});

module.exports = router;
