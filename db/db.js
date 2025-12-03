const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bot.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE,
      referencia TEXT,
      nome TEXT,
      nome_abreviado TEXT,
      codigo_barra TEXT,
      tamanho TEXT,
      marca TEXT,
      superficie TEXT,
      m2_caixa REAL,
      peso_caixa REAL,
      caixas_pallet INTEGER,
      m2_pallet REAL,
      peso_pallet REAL,
      fora_linha INTEGER DEFAULT 0,
      url_produto TEXT,
      id_site INTEGER,
      imagem_url TEXT,
      atualizado_em TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      telefone TEXT UNIQUE,
      validade TEXT,
      ativo INTEGER DEFAULT 0,
      administrador INTEGER DEFAULT 0,
      id_mensagem INTEGER,
      token TEXT,
      api TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contas_whatsapp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      telefone TEXT,
      status TEXT,
      qr_data TEXT,
      atualizado_em TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_hora TEXT,
      telefone TEXT,
      tipo TEXT,
      mensagem TEXT,
      info TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_lid_map (
      lid TEXT PRIMARY KEY,
      telefone TEXT NOT NULL,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE mensagem_whatsapp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descricao TEXT,
      mensagem TEXT NOT NULL,
      padrao BOOLEAN DEFAULT FALSE
    );
  `);

});

module.exports = db;
