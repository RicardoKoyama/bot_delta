const express = require("express");
const router = express.Router();
const ensureAuth = require("../middlewares/auth");
const db = require("../db/db");

router.get("/", ensureAuth, (req, res) => {
  const phone = req.query.phone || "";
  const data_ini = req.query.data_ini || "";
  const data_fim = req.query.data_fim || "";

  let where = "WHERE 1 = 1";
  const params = [];

  if (phone) {
    where += " AND phone LIKE ?";
    params.push(`%${phone}%`);
  }

  if (data_ini) {
    where += " AND date(data_hora) >= date(?)";
    params.push(data_ini);
  }

  if (data_fim) {
    where += " AND date(data_hora) <= date(?)";
    params.push(data_fim);
  }

  db.all(
    `SELECT * FROM logs_bot ${where} ORDER BY id DESC LIMIT 200`,
    params,
    (err, rows) => {
      if (err) return res.send("Erro ao consultar logs.");

      res.render("views/logs/index", {
        logs: rows,
        filtros: { phone, data_ini, data_fim }
      });
    }
  );
});

module.exports = router;
