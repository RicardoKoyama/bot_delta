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
      is_active INTEGER,
      is_admin INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contas_whatsapp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      numero TEXT,
      status TEXT,
      updated_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs_bot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_hora TEXT,
      phone TEXT,
      tipo TEXT,
      mensagem TEXT,
      info TEXT
    )
  `);
});

module.exports = db;
