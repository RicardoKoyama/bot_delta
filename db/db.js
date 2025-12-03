const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bot.db');
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
      cod_barra TEXT,
      tamanho TEXT,
      marca TEXT,
      superficie TEXT,
      m2_caixa NUMERIC,
      peso_caixa NUMERIC,
      cx_pallet INTEGER,
      m2_pallet NUMERIC,
      peso_pallet NUMERIC,
      fora_linha INTEGER DEFAULT 0,
      url_produto TEXT,
      id_site INTEGER,
      img_url TEXT,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      telefone TEXT,
      validade TEXT,
      ativo INTEGER DEFAULT 0,
      administrador INTEGER DEFAULT 0,
      token TEXT,
      api TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contas_whatsapp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      telefone TEXT,
      status TEXT,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs_bot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_hora TEXT,
      telefone TEXT,
      tipo TEXT,
      mensagem TEXT,
      info TEXT
    )
  `);

  db.run(`
      CREATE TABLE IF NOT EXISTS contas_whatsapp_lid_map (
        lid TEXT PRIMARY KEY,
        telefone TEXT NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
  `);

});

module.exports = db;
