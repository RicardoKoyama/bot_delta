// inspect_db.js
const db = require('./db/db');

db.serialize(() => {
  // 1) Total de produtos
  db.get("SELECT COUNT(*) AS total FROM produtos_delta", (err, row) => {
    if (err) {
      console.error("Erro ao contar produtos:", err.message);
      return;
    }
    console.log(`📦 Total de produtos_delta: ${row.total}`);
  });

  // 2) Alguns exemplos de linhas
  db.all(`
    SELECT cod_produto, nome_abreviado, estoque, id_site, img_url
    FROM produtos_delta
    ORDER BY cod_produto
    LIMIT 10
  `, (err, rows) => {
    if (err) {
      console.error("Erro ao listar produtos:", err.message);
      return;
    }

    console.log("\n🔎 Primeiros 10 registros:");
    rows.forEach((r, i) => {
      console.log(
        `${i + 1}. ${r.cod_produto} | ${r.nome_abreviado} | estoque=${r.estoque} | id_site=${r.id_site}`
      );
    });

    // Fecha o DB depois de usar
    db.close();
  });
});
