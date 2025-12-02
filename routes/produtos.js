const express = require('express');
const router = express.Router();
const db = require('../db/db');
const ensureAuth = require('../middlewares/auth');

// LISTAGEM + BUSCA
router.get('/', ensureAuth, (req, res) => {
  const busca = req.query.busca ? `%${req.query.busca}%` : null;

  let sql =
    "SELECT cod_produto, nome_abreviado, img_url, id_site FROM produtos_delta";
  let params = [];

  if (busca) {
    sql += " WHERE nome_abreviado LIKE ? OR cod_produto LIKE ?";
    params.push(busca, busca);
  }

  sql += " ORDER BY cod_produto LIMIT 200";

  db.all(sql, params, (err, rows) => {

    // 🚨 Tratamento de erro
    if (err) {
      console.error("Erro ao consultar produtos_delta:", err);

      return res.render("produtos/index", {
        produtos: [],
        busca: req.query.busca || "",
        erro: "Erro ao consultar produtos"
      });
    }

    // 🚨 Garantia de fallback
    if (!rows) rows = [];

    res.render('produtos/index', {
      produtos: rows,
      busca: req.query.busca || "",
      erro: null
    });
  });
});

// EXPORTAÇÃO
router.get('/exportar', ensureAuth, (req, res) => {
  res.send("<h2>Exportação CSV será adicionada aqui!</h2>");
});

module.exports = router;
