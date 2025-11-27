const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'delta.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS produtos_delta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cod_produto TEXT UNIQUE,
      cod_base TEXT,
      prd_referencia TEXT,
      nome TEXT,
      nome_abreviado TEXT,
      ean TEXT,
      estoque NUMERIC,
      tamanho TEXT,
      marca TEXT,
      superficie TEXT,
      m2_caixa NUMERIC,
      cx_pallet INTEGER,
      m2_pallet NUMERIC,
      peso_caixa NUMERIC,
      peso_pallet NUMERIC,
      fora_linha INTEGER,
      url_produto TEXT,
      id_site INTEGER,
      img_url TEXT,
      ultima_atualizacao TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT,
      nome TEXT,
      validade TEXT,
      is_active INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT,
      termo TEXT,
      resposta TEXT,
      data TEXT
    )
  `);
});

module.exports = db;
