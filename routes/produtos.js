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

router.get('/detalhes/:codigo', ensureAuth, async (req, res) => {
  try {
    const axios = require("axios");
    const codigo = req.params.codigo;

    const BASE = process.env.DELTA_API_URL;
    const APIKEY = process.env.DELTA_TOKEN;

    if (!BASE || !BASE.startsWith("http")) {
      console.error("❌ DELTA_API_URL inválida:", BASE);
      return res.send("Erro: DELTA_API_URL inválida no .env");
    }

    // Remover barras duplicadas
    const cleanBase = BASE.replace(/\/+$/, "");

    // 🔥 Headers obrigatórios da Delta
    const headers = {
      accept: "application/json",
      "content-type": "application/json",
      apikey: APIKEY,
      "User-Agent": "BotDelta/1.0"
    };

    const url = `${cleanBase}/${codigo}`;

    console.log("🔎 Consulta detalhes Delta:", url);

    const resposta = await axios.get(url, { headers });
    const detalhes = resposta.data;

    res.render("produtos/detalhes", { detalhes });

  } catch (err) {
    console.error("❌ Erro ao consultar detalhes:", err);
    res.send("Erro ao consultar API Delta.");
  }
});



// EXPORTAÇÃO
router.get('/exportar', ensureAuth, (req, res) => {
  res.send("<h2>Exportação CSV será adicionada aqui!</h2>");
});

module.exports = router;
