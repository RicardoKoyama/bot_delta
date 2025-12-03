const db = require('../db/db');

async function handleQr(url) {
  const match = url.match(/produto-in\.php\?id=(\d+)/);
  if (!match) return null;

  const id = match[1];

  const row = await new Promise(resolve => {
    db.get(
      "SELECT * FROM produtos WHERE id_site = ?",
      [id],
      (_, row) => resolve(row)
    );
  });

  return row;
}

module.exports = { handleQr };
